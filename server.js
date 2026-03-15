import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

const dbPath = join(__dirname, 'policies.json');
const vehiclesDbPath = join(__dirname, 'vehicles.json');

// Initialize JSON databases if they don't exist
async function initDB() {
    try {
        await fs.access(dbPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(dbPath, JSON.stringify([]));
            console.log('Created local JSON database: policies.json');
        }
    }

    try {
        await fs.access(vehiclesDbPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(vehiclesDbPath, JSON.stringify([]));
            console.log('Created local JSON database: vehicles.json');
        }
    }
}
initDB();

// Helper to read DBs
async function readDB() {
    const data = await fs.readFile(dbPath, 'utf8');
    return JSON.parse(data);
}

async function readVehiclesDB() {
    const data = await fs.readFile(vehiclesDbPath, 'utf8');
    return JSON.parse(data);
}

// Helper to write DBs
async function writeDB(data) {
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
}

async function writeVehiclesDB(data) {
    await fs.writeFile(vehiclesDbPath, JSON.stringify(data, null, 2));
}

// GET: Retrieve all saved policies
app.get('/api/policies', async (req, res) => {
    try {
        const policies = await readDB();
        const vehicles = await readVehiclesDB();

        // Poliçelerde vehicleType eksikse araç kütüğünden eşleştir (Önceki kayıtlar için)
        const enhancedPolicies = policies.map(p => {
            if (!p.vehicleType) {
                const vehicle = vehicles.find(v => String(v.plateInfo).trim() === String(p.plateInfo).trim());
                return { ...p, vehicleType: vehicle ? (vehicle.vehicleType || 'Binek') : 'Binek' };
            }
            return p;
        });

        // Sort descending by id (newest first)
        const sorted = enhancedPolicies.sort((a, b) => b.id - a.id);
        res.json({
            message: 'success',
            data: sorted
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Retrieve all saved vehicles
app.get('/api/vehicles', async (req, res) => {
    try {
        const vehicles = await readVehiclesDB();
        // Sort descending by id (newest first)
        const sorted = vehicles.sort((a, b) => b.id - a.id);
        res.json({
            message: 'success',
            data: sorted
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Add a new vehicle manually
app.post('/api/vehicles', async (req, res) => {
    try {
        const { plateInfo, brand, model, chassisNo, vehicleType } = req.body;
        const vehicles = await readVehiclesDB();

        const isDuplicate = vehicles.some(v => String(v.plateInfo).trim() === String(plateInfo).trim());
        if (isDuplicate) {
            return res.status(409).json({ error: 'Bu plaka sistemde zaten kayıtlı.' });
        }

        const nextId = vehicles.length > 0 ? Math.max(...vehicles.map(v => v.id)) + 1 : 1;
        const newVehicle = {
            id: nextId,
            plateInfo,
            brand,
            model,
            chassisNo,
            vehicleType: vehicleType || 'Binek',
            createdAt: new Date().toISOString()
        };

        vehicles.push(newVehicle);
        await writeVehiclesDB(vehicles);

        res.json({ message: 'success', data: newVehicle });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT: Edit a vehicle
app.put('/api/vehicles/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { plateInfo, brand, model, chassisNo, vehicleType } = req.body;

        let vehicles = await readVehiclesDB();
        const index = vehicles.findIndex(v => v.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Araç bulunamadı.' });
        }

        // Before updating, let's see if the plate was changed to something that already exists
        if (plateInfo !== vehicles[index].plateInfo) {
            const isDuplicate = vehicles.some(v => v.id !== id && String(v.plateInfo).trim() === String(plateInfo).trim());
            if (isDuplicate) {
                return res.status(409).json({ error: 'Değiştirmek istediğiniz plaka başka bir araca ait.' });
            }
        }

        // Save old plate to update policies if cascade update is needed later. For now just update vehicle.
        vehicles[index] = {
            ...vehicles[index],
            plateInfo,
            brand,
            model,
            chassisNo,
            vehicleType: vehicleType !== undefined ? vehicleType : vehicles[index].vehicleType
        };

        await writeVehiclesDB(vehicles);
        res.json({ message: 'success', data: vehicles[index] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Save a new policy
app.post('/api/policies', async (req, res) => {
    try {
        const { policyNumber, ekNo = '0', policyType, isCancelled, startDate, endDate, plateInfo, brand, model, chassisNo, premiumAmount, vehicleType } = req.body;
        const policies = await readDB();

        console.log("Checking duplicate for:", policyNumber);
        console.log("Existing policies:", policies.map(p => p.policyNumber));

        // Check for duplicates
        // Allow same policy number if one is regular and the other is cancelled
        const isDuplicate = policies.some(p =>
            String(p.policyNumber).trim() === String(policyNumber).trim() &&
            String(p.ekNo || '0').trim() === String(ekNo).trim() &&
            (p.isCancelled || false) === (isCancelled || false)
        );
        console.log("isDuplicate result:", isDuplicate);

        if (isDuplicate) {
            return res.status(409).json({ error: 'Bu poliçe numarası sistemde zaten kayıtlı.' });
        }

        // --- Master Vehicle Check ---
        if (plateInfo && plateInfo !== 'Bulunamadı') {
            const vehicles = await readVehiclesDB();
            const vehicleExists = vehicles.some(v => String(v.plateInfo).trim() === String(plateInfo).trim());

            if (!vehicleExists) {
                const nextVehicleId = vehicles.length > 0 ? Math.max(...vehicles.map(v => v.id)) + 1 : 1;
                const newVehicle = {
                    id: nextVehicleId,
                    plateInfo,
                    brand,
                    model,
                    chassisNo,
                    vehicleType: vehicleType || 'Binek',
                    createdAt: new Date().toISOString()
                };
                vehicles.push(newVehicle);
                await writeVehiclesDB(vehicles);
                console.log(`New master vehicle added for plate: ${plateInfo}`);
            }
        }
        // ----------------------------

        // Auto-increment ID
        const nextId = policies.length > 0 ? Math.max(...policies.map(p => p.id)) + 1 : 1;

        const newPolicy = {
            id: nextId,
            policyNumber,
            ekNo,
            policyType,
            isCancelled: isCancelled || false,
            startDate,
            endDate,
            plateInfo,
            brand,
            model,
            chassisNo,
            premiumAmount,
            vehicleType: vehicleType || 'Binek',
            createdAt: new Date().toISOString()
        };

        policies.push(newPolicy);
        await writeDB(policies);

        res.json({
            message: 'success',
            data: newPolicy
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE: Delete a policy
app.delete('/api/policies/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const policies = await readDB();
        const updatedPolicies = policies.filter(p => p.id !== id);

        await writeDB(updatedPolicies);
        res.json({ message: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT: Save Accounting Records for a Policy
app.put('/api/policies/:id/accounting', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { records } = req.body;

        const policies = await readDB();
        const index = policies.findIndex(p => p.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Poliçe bulunamadı.' });
        }

        policies[index].accountingRecords = records;
        await writeDB(policies);

        res.json({ message: 'success', data: policies[index] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE: Delete a vehicle and its associated policies (Cascade)
app.delete('/api/vehicles/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);

        // Find vehicle first
        const vehicles = await readVehiclesDB();
        const vehicleToDelete = vehicles.find(v => v.id === id);

        if (!vehicleToDelete) {
            return res.status(404).json({ error: 'Araç bulunamadı.' });
        }

        const plateToDelete = vehicleToDelete.plateInfo;

        // Delete Vehicle
        const updatedVehicles = vehicles.filter(v => v.id !== id);
        await writeVehiclesDB(updatedVehicles);

        // Cascade delete Policies (Delete any policy that has this exactly matched plate)
        if (plateToDelete && plateToDelete !== 'Bulunamadı') {
            const policies = await readDB();
            const updatedPolicies = policies.filter(p => String(p.plateInfo).trim() !== String(plateToDelete).trim());

            if (policies.length !== updatedPolicies.length) {
                await writeDB(updatedPolicies);
                console.log(`Cascade deleted policies belonging to plate: ${plateToDelete}`);
            }
        }

        res.json({ message: 'deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Backend API Server is running on http://localhost:${PORT}`);
});
