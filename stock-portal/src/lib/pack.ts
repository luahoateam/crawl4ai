export function validateCompanyPack(pack: any): boolean {
  if (!pack || typeof pack !== 'object') {
    return false;
  }

  // 1. Validate Company Details
  if (!pack.company || typeof pack.company !== 'object') {
    return false;
  }
  if (!pack.company.symbol || !pack.company.name) {
    return false;
  }

  // 2. Validate Business Model Structure
  if (!pack.businessModel || typeof pack.businessModel !== 'object') {
    return false;
  }
  
  const bm = pack.businessModel;
  
  // Ensure primary value chain structures exist (inputs, production, outputs)
  if (!Array.isArray(bm.inputs) || !Array.isArray(bm.production) || !Array.isArray(bm.outputs)) {
    return false;
  }

  return true;
}
