import dotenv from "dotenv";
dotenv.config();

import { v2 as cloudinary } from "cloudinary";

// Parse from CLOUDINARY_URL to extract the REAL cloud name
const cloudinaryUrl = process.env.CLOUDINARY_URL;
if (cloudinaryUrl) {
    const match = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
    if (match) {
        const [, parsedKey, parsedSecret, parsedCloud] = match;
        console.log("=== Parsed from CLOUDINARY_URL ===");
        console.log("Cloud Name:", parsedCloud);
        console.log("API Key:", parsedKey);
        console.log("API Secret:", parsedSecret ? "(present)" : "MISSING");

        console.log("\n=== From individual env vars ===");
        console.log("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:", process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
        console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY);
        console.log("CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? "(present)" : "MISSING");

        // Check for mismatches
        if (parsedCloud !== process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
            console.log("\n⚠️  MISMATCH: CLOUDINARY_URL cloud =", parsedCloud, "vs NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME =", process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
        }
        if (parsedKey !== process.env.CLOUDINARY_API_KEY) {
            console.log("⚠️  MISMATCH: CLOUDINARY_URL key =", parsedKey, "vs CLOUDINARY_API_KEY =", process.env.CLOUDINARY_API_KEY);
        }

        // Use CLOUDINARY_URL credentials directly
        cloudinary.config({
            cloud_name: parsedCloud,
            api_key: parsedKey,
            api_secret: parsedSecret,
        });
    }
} else {
    cloudinary.config({
        cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
}

const cfg = cloudinary.config();
console.log("\n=== SDK Config ===");
console.log("cloud_name:", cfg.cloud_name);
console.log("api_key:", cfg.api_key);

async function testPing() {
    try {
        console.log("\n=== Testing API Ping ===");
        const result = await cloudinary.api.ping();
        console.log("✅ Ping successful:", JSON.stringify(result));
    } catch (error) {
        console.error("❌ Ping failed:");
        console.error("Message:", error.message);
        console.error("HTTP Code:", error.http_code);
        if (error.error) console.error("Error detail:", JSON.stringify(error.error));
    }
}

async function testUpload() {
    try {
        console.log("\n=== Testing Upload ===");
        const result = await cloudinary.uploader.upload(
            "https://res.cloudinary.com/demo/image/upload/sample.jpg",
            { folder: "test_connection" }
        );
        console.log("✅ Upload successful!");
        console.log("URL:", result.secure_url);
    } catch (error) {
        console.error("❌ Upload failed:");
        console.error("Message:", error.message);
        console.error("HTTP Code:", error.http_code);
    }
}

await testPing();
await testUpload();
