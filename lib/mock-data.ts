export const MOCK_ROOMS = [
  { id: "RM-101", name: "Deluxe Ocean View", type: "Deluxe", capacity: 2, status: "Active", boardPrice: 200, displayPrice: 220, payablePrice: 220, dateRange: "2024-12-01 - 2024-12-31" },
  { id: "RM-102", name: "Deluxe Ocean View", type: "Deluxe", capacity: 2, status: "Active", boardPrice: 200, displayPrice: 220, payablePrice: 220, dateRange: "2024-12-01 - 2024-12-31" },
  { id: "RM-103", name: "Standard City View", type: "Standard", capacity: 2, status: "Active", boardPrice: 150, displayPrice: 165, payablePrice: 165, dateRange: "2024-12-01 - 2024-12-31" },
  { id: "RM-104", name: "Standard City View", type: "Standard", capacity: 2, status: "Active", boardPrice: 150, displayPrice: 165, payablePrice: 165, dateRange: "2024-12-01 - 2024-12-31" },
  { id: "RM-105", name: "Executive Suite", type: "Suite", capacity: 4, status: "Inactive", boardPrice: 400, displayPrice: 450, payablePrice: 450, dateRange: "2024-12-01 - 2024-12-31" },
];

export const MOCK_PROPOSED_ROOMS = [
  // RM-101 changed
  { id: "RM-101", name: "Deluxe Ocean View", type: "Deluxe", capacity: 2, status: "Active", boardPrice: 220, displayPrice: 242, payablePrice: 242, dateRange: "2024-12-01 - 2024-12-31", changeType: "edited" },
  // RM-102 changed
  { id: "RM-102", name: "Deluxe Ocean View", type: "Deluxe", capacity: 2, status: "Active", boardPrice: 220, displayPrice: 242, payablePrice: 242, dateRange: "2024-12-01 - 2024-12-31", changeType: "edited" },
  // RM-103 unchanged
  { id: "RM-103", name: "Standard City View", type: "Standard", capacity: 2, status: "Active", boardPrice: 150, displayPrice: 165, payablePrice: 165, dateRange: "2024-12-01 - 2024-12-31", changeType: "unchanged" },
  // RM-104 unchanged
  { id: "RM-104", name: "Standard City View", type: "Standard", capacity: 2, status: "Active", boardPrice: 150, displayPrice: 165, payablePrice: 165, dateRange: "2024-12-01 - 2024-12-31", changeType: "unchanged" },
  // RM-105 deleted
  { id: "RM-105", name: "Executive Suite", type: "Suite", capacity: 4, status: "Inactive", boardPrice: 400, displayPrice: 450, payablePrice: 450, dateRange: "2024-12-01 - 2024-12-31", changeType: "deleted" },
  // New rooms
  { id: "RM-201", name: "Presidential Suite", type: "Suite", capacity: 6, status: "Active", boardPrice: 800, displayPrice: 900, payablePrice: 900, dateRange: "2024-12-01 - 2024-12-31", changeType: "added" },
  { id: "RM-202", name: "Presidential Suite", type: "Suite", capacity: 6, status: "Active", boardPrice: 800, displayPrice: 900, payablePrice: 900, dateRange: "2024-12-01 - 2024-12-31", changeType: "added" }
];

export const MOCK_SUMMARY = {
  totalEdited: 40,
  totalDeleted: 1,
  totalAdded: 10,
  targetModel: "Room",
  riskLevel: "Medium",
  requiresApproval: true
};

export const MOCK_LOGS = [
  { step: "Understanding user request", status: "Completed", time: "10:01:23" },
  { step: "Reading uploaded file", status: "Completed", time: "10:01:24" },
  { step: "Detecting target data model: Room", status: "Completed", time: "10:01:25" },
  { step: "Fetching current room data", status: "Completed", time: "10:01:25" },
  { step: "Comparing old values with requested changes", status: "Completed", time: "10:01:26" },
  { step: "Validating against business rules", status: "Warning", time: "10:01:27" },
  { step: "Preparing safe action plan", status: "Completed", time: "10:01:28" },
  { step: "Waiting for user confirmation", status: "Needs Review", time: "10:01:28" },
];
