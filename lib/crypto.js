// utils/crypto.js
import CryptoJS from 'crypto-js'

const secretKey = process.env.SECRET_KEY // Store your secret key in environment variable

export const encrypt = text => {
  return CryptoJS.AES.encrypt(text, secretKey).toString()
}

export const decrypt = cipherText => {
  const bytes = CryptoJS.AES.decrypt(cipherText, secretKey)
  return bytes.toString(CryptoJS.enc.Utf8)
}
