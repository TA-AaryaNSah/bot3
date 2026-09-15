const admin = require("firebase-admin");
const crypto = require("crypto");


// ========================================
// FIREBASE ADMIN INITIALIZATION
// ========================================

if (!admin.apps.length) {

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,

            clientEmail:
                process.env.FIREBASE_CLIENT_EMAIL,

            privateKey:
                process.env.FIREBASE_PRIVATE_KEY
                    .replace(/\\n/g, "\n")
        }),

        databaseURL:
            process.env.FIREBASE_DATABASE_URL
    });

}


const db =
    admin.database();


// ========================================
// RANDOM SHORT ID
// ========================================

function generateId(length = 7) {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    const bytes =
        crypto.randomBytes(length);

    let result = "";

    for (let i = 0; i < length; i++) {

        result +=
            chars[
                bytes[i] % chars.length
            ];

    }

    return result;
}


// ========================================
// URL VALIDATION
// ========================================

function validateUrl(value) {

    try {

        const url =
            new URL(value);

        if (
            url.protocol !== "https:" &&
            url.protocol !== "http:"
        ) {
            return false;
        }

        return url.href;

    } catch {

        return false;

    }

}


// ========================================
// API
// ========================================

module.exports = async function handler(req, res) {

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });

    }


    try {

        const {
            url
        } = req.body || {};


        if (!url) {

            return res.status(400).json({
                error: "URL is required"
            });

        }


        const destination =
            validateUrl(url);


        if (!destination) {

            return res.status(400).json({
                error: "Invalid HTTP/HTTPS URL"
            });

        }


        // ====================================
        // FIND UNIQUE ID
        // ====================================

        let id;

        for (let attempt = 0; attempt < 10; attempt++) {

            const possibleId =
                generateId(7);


            const existing =
                await db
                    .ref("links/" + possibleId)
                    .once("value");


            if (!existing.exists()) {

                id = possibleId;

                break;

            }

        }


        if (!id) {

            return res.status(500).json({
                error: "Could not generate unique ID"
            });

        }


        // ====================================
        // SAVE
        // ====================================

        await db
            .ref("links/" + id)
            .set({

                url: destination,

                active: true,

                createdAt:
                    admin.database.ServerValue.TIMESTAMP

            });


        // ====================================
        // CREATE SHORT-LIVED ACCESS TOKEN
        // ====================================

        const expires =
            Date.now() + (5 * 60 * 1000);


        const payload =
            id + "." + expires;


        const signature =
            crypto
                .createHmac(
                    "sha256",
                    process.env.REDIRECT_SECRET
                )
                .update(payload)
                .digest("hex");


        const token =
            Buffer
                .from(
                    payload + "." + signature
                )
                .toString("base64url");


        const baseUrl =
            `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;


        const shortUrl =
            `${baseUrl}/go/${id}?t=${token}`;


        return res.status(200).json({

            success: true,

            id,

            url: shortUrl,

            expiresAt: expires

        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error: "Internal server error"
        });

    }

};
