import {test,expect} from '@playwright/test';
test('library, replay, legal board, engine hint and bot responses work',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('#game-count')).toHaveText('750');
 await expect(page.locator('#engine-state')).toContainText('Stockfish',{timeout:45000});
 await expect(page.locator('.line')).toHaveCount(3);
 await page.locator('#choose-game').click();await page.locator('#search').fill('Fischer');await expect(page.locator('.game-row').first()).toBeVisible();
 await page.locator('.game-row').first().click();await expect(page.locator('#match-title')).toContainText('Fischer');
 await page.locator('#first').click();await expect(page.locator('#ply')).toHaveText('Move 1');await page.locator('#next').click();await expect(page.locator('#turn')).toHaveText('Black to move');
 await page.locator('.nav[data-mode="bot"]').click();await expect(page.locator('#turn')).toHaveText('White to move');
 await expect(page.locator('#engine-state')).toContainText('Stockfish',{timeout:45000});
 await page.locator('[data-square="e2"]').click();await expect(page.locator('[data-square="e4"]')).toHaveClass(/legal/);await page.locator('[data-square="e4"]').click();
 await expect(page.locator('#history-count')).toHaveText('1 moves',{timeout:30000});
 await expect(page.locator('#turn')).toHaveText('White to move',{timeout:30000});await expect(page.locator('#moves button')).toHaveCount(2);
 await expect(page.locator('#engine-state')).toContainText('Stockfish');await expect(page.locator('#tip')).toContainText('White played');await expect(page.locator('#tip')).toContainText('Black played');await page.locator('#hint').click();await expect(page.locator('#board-message')).toContainText('Engine suggestion');
 expect(errors).toEqual([]);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/tmp/openchess-desktop.png',fullPage:true});
});
test('mobile board fits viewport and library can close',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('#game-count')).toHaveText('750');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 const board=await page.locator('#board').boundingBox();const lastSquare=await page.locator('[data-square="h1"]').boundingBox();expect(lastSquare.y+lastSquare.height).toBeLessThanOrEqual(board.y+board.height+1);await expect(page.locator('.piece').first()).toHaveJSProperty('complete',true);await page.locator('#vision-mode').check();await expect(page.locator('#board')).toHaveClass(/blindfold/);await page.locator('#vision-mode').uncheck();await page.locator('#choose-game').click();await page.locator('#close-library').click();await expect(page.locator('#library')).not.toBeVisible();await page.screenshot({path:'/tmp/openchess-mobile.png',fullPage:true});
});

test('beginner bot can play White and training can resume',async({page})=>{
 await page.goto('/');await expect(page.locator('#game-count')).toHaveText('750');await page.locator('.nav[data-mode="bot"]').click();
 await page.locator('#side').selectOption('b');await page.locator('#elo').focus();await page.locator('#elo').press('Home');await page.locator('#new-bot').click();
 await expect(page.locator('#turn')).toHaveText('Black to move',{timeout:45000});await expect(page.locator('#moves button')).toHaveCount(1);
 await page.locator('.nav[data-mode="practice"]').click();await expect(page.locator('#practice-settings')).toBeVisible();await expect(page.locator('#engine-state')).toContainText('Stockfish',{timeout:45000});
});
