// crypto/base64.js
// Implementação pura de Base64 sem dependências

function base64ToBytes(base64) {
  // Converte Base64 URL-safe para standard
  let clean = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4) {
    clean += '=';
  }
  
  // Decodificar Base64
  const binaryString = atob(clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

module.exports = { base64ToBytes, bytesToBase64 };
