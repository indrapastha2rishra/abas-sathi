    reference: string;
    bankAccount: string;
    remarks?: string;
    proofFileName?: string;
  }): FundInflowRegister => {
    const prop = residentProperty || properties[0];
    const ownership = ownerships.find((o) => o.PropertyID === prop.PropertyID) || ownerships[0];
    const owner = owners.find((o) => o.OwnerID === ownership.OwnerID) || owners[0];

    const nextRecCode = generateNextCode('REC', receipts.length);
    const today = new Date().toISOString().split('T')[0];

    const newReceipt: FundInflowRegister = {
      Transaction_ID: `TXN-ID-${Date.now()}`,
      Receipt_Number: nextRecCode,
      Date_Of_Received: today,
      PropertyID: prop.PropertyID,
      Ownership_ID: ownership.Ownership_ID,
      OwnerID: owner.OwnerID,
      Flat_No: prop.Flat_No,
      Owner_Name: owner.Owner_Name,
      Received_Amount: params.amount,
      Received_Mode: params.mode,
      Received_Reference: params.reference,
      Bank_Account: params.bankAccount,
      Unallocated_Amount: params.amount,
      Remarks: params.remarks || `Submitted against invoices: ${params.invoiceIds.join(', ')}`,
      File_Reference: params.proofFileName || `${nextRecCode}_proof.pdf`,
      Created_By: currentUser.Full_Name,
      Created_At: new Date().toISOString(),
      Receipt_Status: 'Pending Verification',
    };

    setReceipts((prev) => [newReceipt, ...prev]);

    // Update target invoices to 'Pending Verification' so resident knows it is in review
    setInvoices((prev) =>
      prev.map((inv) =>
        params.invoiceIds.includes(inv.InvoiceID)
          ? { ...inv, Invoice_Status: 'Pending Verification' as const }
          : inv
      )
    );

    logAction(
      'CREATE',
      'Fund Inflow Register',
      nextRecCode,
      'Pending',
      `₹${params.amount} via ${params.mode} (Ref: ${params.reference})`,
      'Resident submitted payment for verification'
    );

    return newReceipt;
  };

  // Admin/Accountant confirms payment & allocates
  const confirmAndAllocatePayment = (
    receiptId: string,
    customAllocations?: { invoiceId: string; amount: number }[]
  ) => {
    const receipt = receipts.find((r) => r.Transaction_ID === receiptId || r.Receipt_Number === receiptId);
    if (!receipt) return;

    let currentReceipt: FundInflowRegister = { ...receipt, Receipt_Status: 'Confirmed' };
    const newBillAllocations: BillWiseDetails[] = [];
    let updatedInvoicesMap = new Map<string, InvoiceRegister>();

    // If custom allocations provided, use them; otherwise auto-allocate to property's unpaid invoices
    if (customAllocations && customAllocations.length > 0) {
      for (const alloc of customAllocations) {
        const inv = updatedInvoicesMap.get(alloc.invoiceId) || invoices.find((i) => i.InvoiceID === alloc.invoiceId);
        if (!inv) continue;

        const res = allocatePaymentToInvoice({
          receipt: currentReceipt,
          invoice: inv,
          requestedAmount: alloc.amount,
          userId: currentUser.Full_Name,
          remarks: `Confirmed & allocated against ${receipt.Receipt_Number}`,
        });

        if (res.success && res.billDetail && res.updatedReceipt && res.updatedInvoice) {
          currentReceipt = res.updatedReceipt;
          newBillAllocations.push(res.billDetail);
          updatedInvoicesMap.set(res.updatedInvoice.InvoiceID, res.updatedInvoice);
        }
      }
    } else {
      // Auto-allocate against unpaid/pending invoices for this flat
      const flatInvoices = invoices.filter(
        (i) => i.PropertyID === receipt.PropertyID && i.Outstanding_Amount > 0
      );

      for (const inv of flatInvoices) {
        if (currentReceipt.Unallocated_Amount <= 0) break;
        const targetInv = updatedInvoicesMap.get(inv.InvoiceID) || inv;

        const res = allocatePaymentToInvoice({
          receipt: currentReceipt,
          invoice: targetInv,
          userId: currentUser.Full_Name,
          remarks: `Auto-allocated against ${receipt.Receipt_Number}`,
        });

        if (res.success && res.billDetail && res.updatedReceipt && res.updatedInvoice) {
          currentReceipt = res.updatedReceipt;
          newBillAllocations.push(res.billDetail);
          updatedInvoicesMap.set(res.updatedInvoice.InvoiceID, res.updatedInvoice);
        }
      }
    }

    // Update state
    setReceipts((prev) => prev.map((r) => (r.Transaction_ID === currentReceipt.Transaction_ID ? currentReceipt : r)));
    if (newBillAllocations.length > 0) {
      setBillAllocations((prev) => [...newBillAllocations, ...prev]);
    }
    if (updatedInvoicesMap.size > 0) {
      setInvoices((prev) =>
        prev.map((i) => (updatedInvoicesMap.has(i.InvoiceID) ? updatedInvoicesMap.get(i.InvoiceID)! : i))
      );
    }

    // Update bank account balance
    setBankAccounts((prev) =>
      prev.map((b) =>
        b.BankAccount_ID === currentReceipt.Bank_Account
          ? { ...b, Current_Balance: b.Current_Balance + currentReceipt.Received_Amount }
          : b
      )
    );

    logAction(
      'ALLOCATE',
      'Bill Wise Details',
      receipt.Receipt_Number,
      'Unallocated',
      `Allocated ₹${receipt.Received_Amount - currentReceipt.Unallocated_Amount} (Advance remaining: ₹${currentReceipt.Unallocated_Amount})`,
      'Accountant confirmed and completed bill allocation'
    );
  };

  // Add Expense
  const addExpense = (
    params: Omit<
      ExpenseRegister,
      | 'Expense_ID'
      | 'Voucher_No'
      | 'Created_At'
      | 'Created_By'
      | 'Approved_At'
      | 'Approved_By'
      | 'Cancelled_At'
      | 'Cancelled_By'
      | 'Cancellation_Reason'
    >
  ): ExpenseRegister => {
    const nextVouCode = generateNextCode('VOU', expenses.length);
    const newExp: ExpenseRegister = {
