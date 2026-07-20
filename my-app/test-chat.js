async page => {
    await page.waitForTimeout(10000);
    const f = page.frames().find(x => x.url().startsWith('http://localhost:5173'));
    if(!f) return 'No iframe';
    await f.locator('button[aria-label="Open chat"]').click();
    await page.waitForTimeout(1000);
    await f.locator('textarea').fill('What were the total sales in 2014?');
    await f.locator('button[aria-label="Send message"]').click();
    await page.waitForTimeout(10000);
    return 'Sent';
}
