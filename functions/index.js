const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per 15 minutes
    message: { error: "Too many activation attempts from this IP, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

// Handle GET and POST on the root of the express app
app.use('/', async (req, res) => {
    try {
        const activationCode = req.body.activationCode || req.query.activationCode;
        if (!activationCode) {
            return res.status(400).json({ error: "Missing activation code" });
        }

        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(activationCode).digest('hex');

        const db = admin.firestore();
        const docRef = db.collection('projectid').doc(hash);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(403).json({ error: "Invalid activation code" });
        }

        const data = doc.data();
        if (!data.active) {
            return res.status(403).json({ error: "Activation code is disabled" });
        }

        // Return the core mapping required for ETL to finish
        const mapping = {
            'RD NAME': 'RD Name',
            'DATE': 'Date',
            'WEEK': 'Week',
            'BRANCH_NAME': 'Branch Name',
            'SALES_REP_ID': 'Employee Code',
            'SALES_REP_NAME': 'Employee Name',
            'KEY_ACCOUNT': 'Channel',
            'ACCOUNT CODE': 'Sold To Customer number',
            'CUSTOMER_NAME': 'Sold To Customer Name',
            'CATEGORY': 'Category',
            'SKU CODE': 'Product Code',
            'SKU NAME': 'Product Description',
            'VOLUME': 'Volume',
            'VALUE': 'Net Value',
            'GOOD RETURNS': 'Good Stock Returns',
            'BAD RETURNS': 'Bad Stock Returns',
            'PARTY_CLASSIFICATION_DESCRIPTION': 'Channel_Classification',
            'GEO_LOCATION_HIERARCHYDESCRIPTION': 'Brgy',
            'CITY': 'Town',
            'STATE_PROVINCE': 'Province',
            'FS': 'FS',
            'CHANNEL': 'RTM Model',
            'GT_Channel': 'GT Channel'
        };

        res.status(200).json({ status: "success", mapping: mapping });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

exports.getCoreMapping = functions.https.onRequest(app);
