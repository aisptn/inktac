/**
 * Parses raw image ArrayBuffer to detect color space, ICC profiles, and CMYK signatures.
 * Pure Vanilla JavaScript (ES Module).
 */
export async function detectImageProfile(buffer, fileName) {
  const bytes = new Uint8Array(buffer);
  const dataView = new DataView(buffer);

  // Check JPEG (0xFF, 0xD8)
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return parseJpegProfile(bytes, dataView, fileName);
  }

  // Check PNG (0x89, 0x50, 0x4E, 0x47)
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return parsePngProfile(bytes, fileName);
  }

  // Check TIFF (II* / MM*)
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)) {
    return parseTiffProfile(bytes, dataView, fileName);
  }

  // Fallback for WebP / others
  return {
    detectedMode: 'rgb',
    hasCmykProfile: false,
    numberOfComponents: 3,
    format: fileName.toLowerCase().endsWith('.webp') ? 'webp' : 'unknown',
    details: 'Standard RGB / sRGB assumed',
  };
}

function parseJpegProfile(bytes, dataView, _fileName) {
  let offset = 2;
  const len = bytes.length;
  let hasCmykProfile = false;
  let profileName;
  let colorSpaceSignature;
  let numComponents = 3;
  let details = 'Standard RGB JPEG';
  let adobeTransform = null;

  while (offset < len - 4) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === 0xda) break; // SOS
    if (marker === 0xd9) break; // EOI

    if (offset + 4 > len) break;
    const markerLength = dataView.getUint16(offset + 2, false);

    // APP2 (0xFFE2) - ICC_PROFILE
    if (marker === 0xe2) {
      const app2Header = readAscii(bytes, offset + 4, 12);
      if (app2Header.startsWith('ICC_PROFILE')) {
        const iccOffset = offset + 4 + 14;
        if (iccOffset + 128 <= len) {
          const dataColorSpace = readAscii(bytes, iccOffset + 16, 4).trim();
          colorSpaceSignature = dataColorSpace;

          if (dataColorSpace === 'CMYK') {
            hasCmykProfile = true;
            numComponents = 4;
            details = 'Embedded CMYK ICC Profile detected';
          }

          const foundDesc = extractIccDescription(bytes, iccOffset, markerLength - 18);
          if (foundDesc) {
            profileName = foundDesc;
            details = `Embedded ICC Profile: ${foundDesc} (${dataColorSpace})`;
          }
        }
      }
    }

    // APP14 (0xFFEE) - Adobe color transform
    if (marker === 0xee) {
      const adobeHeader = readAscii(bytes, offset + 4, 5);
      if (adobeHeader === 'Adobe' && offset + 15 <= len) {
        adobeTransform = bytes[offset + 15];
        if (adobeTransform === 0 || adobeTransform === 2) {
          hasCmykProfile = true;
          numComponents = 4;
          details = adobeTransform === 2 
            ? 'Adobe YCCK color transform detected (CMYK mode)' 
            : 'Adobe CMYK marker detected';
        }
      }
    }

    // SOF0 (0xFFC0), SOF1 (0xFFC1), SOF2 (0xFFC2) - Frame header
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (offset + 9 < len) {
        const componentsInFrame = bytes[offset + 9];
        numComponents = componentsInFrame;
        if (componentsInFrame === 4) {
          hasCmykProfile = true;
          if (!details.includes('CMYK')) {
            details = '4-channel CMYK JPEG detected (SOF marker)';
          }
        }
      }
    }

    offset += 2 + markerLength;
  }

  return {
    detectedMode: hasCmykProfile ? 'cmyk' : 'rgb',
    hasCmykProfile,
    profileName,
    colorSpaceSignature,
    numberOfComponents: numComponents,
    format: 'jpeg',
    details,
  };
}

function parsePngProfile(bytes, _fileName) {
  let offset = 8;
  const len = bytes.length;
  let hasCmykProfile = false;
  let profileName;
  let colorSpaceSig;

  while (offset + 8 < len) {
    const chunkLength = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const chunkType = readAscii(bytes, offset + 4, 4);

    if (chunkType === 'iCCP') {
      let nameEnd = offset + 8;
      while (nameEnd < offset + 8 + Math.min(80, chunkLength) && bytes[nameEnd] !== 0) {
        nameEnd++;
      }
      profileName = readAscii(bytes, offset + 8, nameEnd - (offset + 8));

      if (/cmyk/i.test(profileName)) {
        hasCmykProfile = true;
        colorSpaceSig = 'CMYK';
      }
    }

    offset += 12 + chunkLength;
    if (chunkType === 'IEND') break;
  }

  return {
    detectedMode: hasCmykProfile ? 'cmyk' : 'rgb',
    hasCmykProfile,
    profileName,
    colorSpaceSignature: colorSpaceSig || 'RGB',
    numberOfComponents: hasCmykProfile ? 4 : 3,
    format: 'png',
    details: hasCmykProfile
      ? `PNG with CMYK ICC profile (${profileName})`
      : profileName ? `PNG with embedded ICC profile: ${profileName}` : 'Standard RGB PNG',
  };
}

function parseTiffProfile(bytes, dataView, _fileName) {
  const isLittle = bytes[0] === 0x49;
  const firstIfd = dataView.getUint32(4, isLittle);
  let hasCmyk = false;
  let details = 'TIFF Image';
  let numComponents = 3;

  if (firstIfd < bytes.length - 2) {
    const numEntries = dataView.getUint16(firstIfd, isLittle);
    for (let i = 0; i < numEntries; i++) {
      const entryOffset = firstIfd + 2 + i * 12;
      if (entryOffset + 12 > bytes.length) break;
      const tag = dataView.getUint16(entryOffset, isLittle);

      // PhotometricInterpretation tag 0x0106: 5 = Separated (CMYK)
      if (tag === 0x0106) {
        const val = dataView.getUint16(entryOffset + 8, isLittle);
        if (val === 5) {
          hasCmyk = true;
          numComponents = 4;
          details = 'TIFF Separated CMYK (Photometric 5)';
        }
      }
      // SamplesPerPixel tag 0x0115
      if (tag === 0x0115) {
        const samples = dataView.getUint16(entryOffset + 8, isLittle);
        if (samples === 4) {
          hasCmyk = true;
          numComponents = 4;
        }
      }
    }
  }

  return {
    detectedMode: hasCmyk ? 'cmyk' : 'rgb',
    hasCmykProfile: hasCmyk,
    numberOfComponents: numComponents,
    format: 'tiff',
    details,
  };
}

function readAscii(bytes, start, length) {
  let str = '';
  const end = Math.min(bytes.length, start + length);
  for (let i = start; i < end; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

function extractIccDescription(bytes, iccOffset, maxLength) {
  try {
    const end = Math.min(bytes.length, iccOffset + maxLength);
    for (let i = iccOffset + 128; i < end - 12; i += 4) {
      if (
        bytes[i] === 0x64 &&
        bytes[i + 1] === 0x65 &&
        bytes[i + 2] === 0x73 &&
        bytes[i + 3] === 0x63
      ) {
        const tagDataOffset = (bytes[i + 4] << 24) | (bytes[i + 5] << 16) | (bytes[i + 6] << 8) | bytes[i + 7];
        const tagSize = (bytes[i + 8] << 24) | (bytes[i + 9] << 16) | (bytes[i + 10] << 8) | bytes[i + 11];
        
        const descPtr = iccOffset + tagDataOffset;
        if (descPtr + 12 < bytes.length && tagSize > 8) {
          const descType = readAscii(bytes, descPtr, 4);
          if (descType === 'desc') {
            const strLen = (bytes[descPtr + 8] << 24) | (bytes[descPtr + 9] << 16) | (bytes[descPtr + 10] << 8) | bytes[descPtr + 11];
            if (strLen > 0 && descPtr + 12 + strLen <= bytes.length) {
              return readAscii(bytes, descPtr + 12, Math.min(strLen - 1, 80));
            }
          } else if (descType === 'mluc') {
            const strLen = (bytes[descPtr + 20] << 24) | (bytes[descPtr + 21] << 16) | (bytes[descPtr + 22] << 8) | bytes[descPtr + 23];
            const strOffset = (bytes[descPtr + 24] << 24) | (bytes[descPtr + 25] << 16) | (bytes[descPtr + 26] << 8) | bytes[descPtr + 27];
            const p = descPtr + strOffset;
            if (p + strLen <= bytes.length) {
              let res = '';
              for (let k = 0; k < strLen; k += 2) {
                res += String.fromCharCode((bytes[p + k] << 8) | bytes[p + k + 1]);
              }
              return res.trim();
            }
          }
        }
      }
    }
  } catch {
    // Graceful fallback
  }
  return null;
}
