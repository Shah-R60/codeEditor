require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

console.log("Cloudinary Config:", cloudinary.config());

// Create a dummy text file to test raw upload
fs.writeFileSync('test.txt', 'Hello Cloudinary!');

async function testUpload() {
  try {
    const result = await cloudinary.uploader.upload('test.txt', {
      resource_type: "raw"
    });
    console.log("Raw upload success:", result.secure_url);
  } catch (err) {
    console.error("Raw upload failed:", err);
  }

  try {
    const result2 = await cloudinary.uploader.upload('test.txt', {
      resource_type: "auto"
    });
    console.log("Auto upload success:", result2.secure_url);
  } catch (err) {
    console.error("Auto upload failed:", err);
  }
}

testUpload();
