async page => {
    await page.waitForTimeout(10000);
    const f = page.frames().find(x => x.url().startsWith('http://localhost:5173'));
    if(!f) return 'No iframe';
    
    await page.waitForTimeout(10000); // wait for data to load
    
    // Read the sales value from the grid
    const text = await f.locator('.ms-DetailsRow').first().innerText().catch(() => 'No row found');
    console.log("FIRST ROW TEXT:", text);
    
    // Click Next
    await f.locator('button:has-text("Next")').click();
    await page.waitForTimeout(2000); // Wait for page 2 load
    
    const text2 = await f.locator('.ms-DetailsRow').first().innerText().catch(() => 'No row found');
    console.log("FIRST ROW TEXT PAGE 2:", text2);
    
    return 'Done';
}
