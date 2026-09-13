// Faulty-equipment tracking ("อุปกรณ์เสีย") is built end to end — the UI in
// pages/ProjectEquipment.tsx and pages/Equipment.tsx, the API routes in
// backend/src/routes/projectEquipment.ts + equipment.ts, and the
// ProjectEquipmentFault table — but hidden for now at the user's request.
//
// Nothing was removed. Flip this to `true` to bring back every "อุปกรณ์เสีย"
// affordance (the view toggle, the "mark as faulty" action, the summary card,
// and the faulty table).
export const SHOW_FAULTY_EQUIPMENT: boolean = false
