// Ids of records kept in capped lists (diary, chronicle, coverage, memory…): the natural id is built from the week and
// the length of the list, which stops growing once the list is full, so two records of the same week could share it.
// The first free variant (-2, -3…) keeps every id unique and the game deterministic.
export const uniqueId = (list = [], base) => { let id = base; for (let n = 2; list.some(item => item?.id === id); n++) id = `${base}-${n}`; return id; };
