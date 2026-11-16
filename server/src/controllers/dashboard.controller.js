import dashboardService from '../services/dashboard.service.js';

export async function getDashboard(_req, res) {
  const summary = await dashboardService.getDashboardSummary();
  res.status(200).json({
    success: true,
    data: summary,
  });
}

export function getMeta(_req, res) {
  const meta = dashboardService.getSystemMeta();
  res.status(200).json({
    success: true,
    data: meta,
  });
}

export default {
  getDashboard,
  getMeta,
};
