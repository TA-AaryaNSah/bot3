const admin = require("firebase-admin");
const crypto = require("crypto");


// ========================================
// FIREBASE
// ========================================

if (!admin.apps.length) {

    admin.initializeApp({

        credential:
            admin.credential.cert({

                projectId:
                    process.env.FIREBASE_PROJECT_ID,

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
// VERIFY TOKEN
// ========================================

function verifyToken(token, id) {

    try {

        const decoded =
            Buffer
                .from(
                    token,
                    "base64url"
                )
                .toString("utf8");


        const parts =
            decoded.split(".");


        if (parts.length !== 3) {
            return false;
        }


        const tokenId =
            parts[0];

        const expires =
            Number(parts[1]);

        const signature =
            parts[2];


        if (tokenId !== id) {
            return false;
        }


        if (
            !expires ||
            Date.now() > expires
        ) {
            return false;
        }


        const payload =
            tokenId + "." + expires;


        const expected =
            crypto
                .createHmac(
                    "sha256",
                    process.env.REDIRECT_SECRET
                )
                .update(payload)
                .digest("hex");


        /*
         * Timing-safe comparison
         */

        if (
            signature.length !==
            expected.length
        ) {
            return false;
        }


        return crypto.timingSafeEqual(

            Buffer.from(signature),

            Buffer.from(expected)

        );


    } catch {

        return false;

    }

}


// ========================================
// HANDLER
// ========================================

module.exports = async function handler(req, res) {

    const id =
        req.query.id;

    const token =
        req.query.t;


    // ====================================
    // NO ID
    // ====================================

    if (!id) {

        return res.status(404).send(
            "Invalid short link."
        );

    }


    // ====================================
    // NO TOKEN
    // ====================================

    if (!token) {

        return res.status(403).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Access Denied</title>
                <meta name="viewport"
                      content="width=device-width,initial-scale=1">
                <style>
                    body {
                        margin:0;
                        min-height:100vh;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        background:#0b0d12;
                        color:white;
                        font-family:Arial;
                        text-align:center;
                    }

                    .box {
                        padding:30px;
                    }

                    h2 {
                        margin-bottom:10px;
                    }

                    p {
                        color:#999;
                    }
                </style>
            </head>
            <body>
                <div class="box">
                    <h2>Access Denied</h2>
                    <p>This link cannot be opened directly.</p>
                </div>
            </body>
            </html>
        `);

    }


    // ====================================
    // VERIFY TOKEN
    // ====================================

    if (!verifyToken(token, id)) {

        return res.status(403).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Link Expired</title>
                <meta name="viewport"
                      content="width=device-width,initial-scale=1">
                <style>
                    body {
                        margin:0;
                        min-height:100vh;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        background:#0b0d12;
                        color:white;
                        font-family:Arial;
                        text-align:center;
                    }

                    p {
                        color:#999;
                    }
                </style>
            </head>
            <body>
                <div>
                    <h2>Invalid or Expired Link</h2>
                    <p>Please generate a new link.</p>
                </div>
            </body>
            </html>
        `);

    }


    try {

        // ====================================
        // GET FIREBASE DATA
        // ====================================

        const snapshot =
            await db
                .ref("links/" + id)
                .once("value");


        if (!snapshot.exists()) {

            return res.status(404).send(
                "Short link not found."
            );

        }


        const data =
            snapshot.val();


        // ====================================
        // CHECK ACTIVE
        // ====================================

        if (data.active === false) {

            return res.status(410).send(
                "This link has been disabled."
            );

        }


        // ====================================
        // VALIDATE DESTINATION
        // ====================================

        let destination;

        try {

            destination =
                new URL(data.url);

        } catch {

            return res.status(500).send(
                "Invalid destination."
            );

        }


        if (
            destination.protocol !== "https:" &&
            destination.protocol !== "http:"
        ) {

            return res.status(400).send(
                "Unsupported destination."
            );

        }


        // ====================================
        // REDIRECT
        // ====================================

        res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate"
        );


        return res.redirect(
            302,
            destination.href
        );


    } catch (error) {

        console.error(error);

        return res.status(500).send(
            "Unable to process link."
        );

    }

};
