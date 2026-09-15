import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getDatabase,
    ref,
    get
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";


// ================================
// FIREBASE CONFIG
// ================================

const firebaseConfig = {
    apiKey: "AIzaSyAw5aG4WghgQtTqtSWY7YBMo28p-eTx1BM",
    authDomain: "realtime-64520.firebaseapp.com",
    databaseURL: "https://realtime-64520-default-rtdb.firebaseio.com",
    projectId: "realtime-64520",
    storageBucket: "realtime-64520.firebasestorage.app",
    messagingSenderId: "116693487239",
    appId: "1:116693487239:web:e3075a83602a20af2cb222",
    measurementId: "G-9LNW64HM7Y"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

const db = getDatabase(app);


// ================================
// GET SHORT ID
// ================================

const params = new URLSearchParams(
    window.location.search
);

const shortId = params.get("l");


// ================================
// DIRECT ACCESS PROTECTION
// ================================

if (!shortId) {

    document.getElementById("loader").style.display = "none";

    document.getElementById("title").textContent =
        "Access Restricted";

    document.getElementById("status").textContent =
        "No valid redirect link was provided.";

} else {

    redirectUser(shortId);

}


// ================================
// REDIRECT FUNCTION
// ================================

async function redirectUser(id) {

    try {

        document.getElementById("status").textContent =
            "Verifying link...";


        const linkRef = ref(
            db,
            "links/" + id
        );


        const snapshot = await get(linkRef);


        if (!snapshot.exists()) {

            showError(
                "This short link does not exist."
            );

            return;
        }


        const data = snapshot.val();


        // Check disabled links
        if (data.active === false) {

            showError(
                "This link has been disabled."
            );

            return;
        }


        const target = data.url;


        // Validate URL
        let targetURL;

        try {

            targetURL = new URL(target);

        } catch {

            showError(
                "Invalid destination URL."
            );

            return;
        }


        // Only HTTP/HTTPS
        if (
            targetURL.protocol !== "http:" &&
            targetURL.protocol !== "https:"
        ) {

            showError(
                "Unsupported destination."
            );

            return;
        }


        document.getElementById("status").textContent =
            "Redirecting...";


        // Small delay
        setTimeout(() => {

            window.location.replace(
                targetURL.href
            );

        }, 700);


    } catch (error) {

        console.error(error);

        showError(
            "Unable to verify this link."
        );

    }

}


// ================================
// ERROR
// ================================

function showError(message) {

    document.getElementById("loader")
        .style.display = "none";

    document.getElementById("title")
        .textContent = "Link Error";

    document.getElementById("status")
        .style.display = "none";

    const error =
        document.getElementById("error");

    error.textContent = message;

    error.style.display = "block";
}
