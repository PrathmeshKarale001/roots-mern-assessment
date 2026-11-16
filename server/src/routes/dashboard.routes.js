import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/dashboard', dashboardController.getDashboard);
router.get('/meta', dashboardController.getMeta);

export default router;
