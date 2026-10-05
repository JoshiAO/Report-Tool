const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

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
        const activationCode = req.body.activationCode || req.query.activationCode || req.body.activation_code || req.query.activation_code;
        if (!activationCode) {
            return res.status(400).json({ error: "Missing activation code" });
        }

        const crypto = require('crypto');
        const normalizedCode = String(activationCode).trim();
        const hash = crypto.createHash('sha256').update(normalizedCode).digest('hex');
        const db = admin.firestore();

        const userPayload = {
            first_name: req.body.first_name || req.body.firstName || '',
            last_name: req.body.last_name || req.body.lastName || '',
            email: req.body.email || '',
            company: req.body.company || req.body.company_name || '',
            role: req.body.role || 'user',
            projectname: String(req.body.projectname || req.body.project_name || 'reporttool').toLowerCase(),
            activation_code: normalizedCode,
            activationCode: normalizedCode,
            active: true,
            enabled: true,
            status: 'active',
            license_type: req.body.license_type || req.body.licenseType || 'standard',
            machine_hash: req.body.machine_hash || req.body.machineHash || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_active: new Date().toISOString(),
            source: 'desktop_app'
        };

        let userDoc = null;
        const directRef = db.collection('nodes').doc(hash);
        const directDoc = await directRef.get();
        if (directDoc.exists) {
            userDoc = directDoc;
        } else {
            const q1 = await db.collection('nodes').where('activation_code', '==', normalizedCode).limit(1).get();
            if (!q1.empty) {
                userDoc = q1.docs[0];
            } else {
                const q2 = await db.collection('nodes').where('activationCode', '==', normalizedCode).limit(1).get();
                if (!q2.empty) {
                    userDoc = q2.docs[0];
                }
            }
        }

        if (!userDoc || !userDoc.exists) {
            await directRef.set({
                ...userPayload,
                created_at: userPayload.created_at,
                updated_at: userPayload.updated_at,
                last_active: userPayload.last_active,
            }, { merge: true });
        } else {
            const existing = userDoc.data() || {};
            await userDoc.ref.set({
                ...existing,
                ...userPayload,
                updated_at: new Date().toISOString(),
                last_active: new Date().toISOString(),
                projectname: String(existing.projectname || userPayload.projectname).toLowerCase(),
                status: existing.status || 'active',
                active: existing.active !== false && userPayload.active !== false,
            }, { merge: true });
        }

        const storedDoc = await directRef.get();
        const data = storedDoc.exists ? storedDoc.data() : userPayload;

        const isActive = data.active === true || data.status === 'active' || data.isActive === true || data.enabled === true;
        if (!isActive) {
            return res.status(403).json({ error: "Activation code is disabled" });
        }

        const projectName = String(data.projectname || data.project_name || data.software || data.app || '').toLowerCase();
        if (projectName && projectName !== 'reporttool') {
            return res.status(403).json({ error: "Activation code does not match this software project" });
        }

        if (!projectName) {
            return res.status(403).json({ error: "Node record is missing project assignment" });
        }

        const userMeta = {
            id: storedDoc.id,
            first_name: data.first_name || data.firstName || '',
            last_name: data.last_name || data.lastName || '',
            email: data.email || '',
            company: data.company || data.company_name || '',
            role: data.role || 'user',
            status: data.status || (data.active === true ? 'active' : 'inactive'),
            projectname: projectName,
            activation_code: data.activation_code || data.activationCode || normalizedCode,
            created_at: data.created_at || data.createdAt || null,
            updated_at: data.updated_at || data.updatedAt || null,
            last_active: data.last_active || data.lastActive || null,
            machine_hash: data.machine_hash || data.machineHash || null,
            license_type: data.license_type || data.licenseType || 'standard'
        };

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

        res.status(200).json({ status: "success", mapping, user: userMeta });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

exports.getCoreMapping = functions.https.onRequest(app);
