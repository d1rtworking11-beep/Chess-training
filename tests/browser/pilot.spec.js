import {test,expect} from '@playwright/test';
import {Chess} from 'chess.js';
test('library, replay, hidden lines, hints, move comments and a timed bot reply work',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('#game-count')).toHaveText('750');
 await expect(page.locator('#engine-state')).toContainText('Stockfish',{timeout:45000});
 await expect(page.locator('.line')).toHaveCount(0);await page.locator('#engine-toggle').click();await expect(page.locator('.line')).toHaveCount(3);await expect(page.locator('.square.last')).toHaveCount(2);
 await page.locator('#choose-game').click();await page.locator('#search').fill('Fischer');await expect(page.locator('.game-row').first()).toBeVisible();
 await page.locator('.game-row').first().click();await expect(page.locator('#match-title')).toContainText('Fischer');
 await page.locator('#first').click();await expect(page.locator('#ply')).toHaveText('Move 1');await page.locator('#next').click();await expect(page.locator('#turn')).toHaveText('Black to move');
 await page.locator('.nav[data-mode="bot"]').click();await expect(page.locator('#turn')).toHaveText('White to move');
 await expect(page.locator('#engine-state')).toContainText('Stockfish',{timeout:45000});
 await page.locator('[data-square="e2"]').click();await expect(page.locator('[data-square="e4"]')).toHaveClass(/legal/);const movedAt=Date.now();await page.locator('[data-square="e4"]').click();
 expect(await page.evaluate(()=>document.getAnimations().length)).toBeGreaterThan(0);
 await expect(page.locator('#review-who')).toContainText('Your move',{timeout:30000});await expect(page.locator('#board-message')).toContainText('thinking');await expect(page.locator('#hint')).toBeDisabled();
 await expect(page.locator('#history-count')).toHaveText('1 move',{timeout:30000});
 await expect(page.locator('#turn')).toHaveText('White to move',{timeout:30000});expect(Date.now()-movedAt).toBeGreaterThan(2900);await expect(page.locator('#moves button')).toHaveCount(2);
 await expect(page.locator('#engine-state')).toContainText('Stockfish');await expect(page.locator('#moves .mini')).toHaveCount(2,{timeout:30000});await expect(page.locator('#board .badge')).toHaveCount(1);await expect(page.locator('#review-title')).toHaveText(/ is (brilliant|a great move|best|excellent|good|a book move|forced|an inaccuracy|a mistake|a miss|a blunder)$/);await expect(page.locator('#review-text')).not.toBeEmpty();
 await expect(page.locator('#review-who')).toContainText("Bot's move");await expect(page.locator('#review-previous')).toContainText('Your move');await expect(page.locator('#review-previous p')).not.toBeEmpty();
 await expect(page.locator('#engine-state')).toContainText('depth',{timeout:30000});await expect(page.locator('.line')).toHaveCount(0);await expect(page.locator('#tip')).not.toContainText('Consider');
 await page.locator('#hint').click();await expect(page.locator('#hint-text')).toContainText('Hint: look at your');await expect(page.locator('.square.hint-from')).toHaveCount(1);await expect(page.locator('#hint-label')).toHaveText('Show best move');
 await page.locator('#hint').click();await expect(page.locator('#hint-text')).toContainText('Best move:');await expect(page.locator('.arrows.hint')).toHaveCount(1);
 await page.locator('#hint').click();await expect(page.locator('#hint-text')).toBeEmpty();await expect(page.locator('.arrows.hint')).toHaveCount(0);
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

test('full game review rates every move with accuracy, tally and graph',async({page})=>{
 test.setTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('#game-count')).toHaveText('750');
 await expect(page.locator('#review-title')).toHaveText(/ is (brilliant|a great move|best|excellent|good|a book move|forced|an inaccuracy|a mistake|a miss|a blunder)$/,{timeout:45000});await expect(page.locator('#board .badge')).toHaveCount(1);
 await page.locator('#choose-game').click();await page.locator('#search').fill('Sillars');await expect(page.locator('.game-row')).toHaveCount(1);await page.locator('.game-row').click();await expect(page.locator('#match-title')).toContainText('Sillars');
 await page.locator('#review-game').click();await expect(page.locator('#review-progress')).toBeVisible();
 await expect(page.locator('#review-summary')).toBeVisible({timeout:170000});
 await expect(page.locator('#accuracy-white')).toHaveText(/^\d+\.\d$/);await expect(page.locator('#accuracy-black')).toHaveText(/^\d+\.\d$/);
 await expect(page.locator('#tally .tally-row')).toHaveCount(11);await expect(page.locator('#review-opening')).toHaveText(/^Opening: \S/);
 const labels=await page.locator('#moves .mini').evaluateAll(els=>els.map(e=>e.title));const firstOut=labels.findIndex(l=>l!=='Book'&&l!=='Forced');expect(labels[0]).toBe('Book');expect(firstOut).toBeGreaterThan(0);expect(labels.slice(firstOut)).not.toContain('Book');await expect(page.locator('#eval-graph path')).toHaveCount(1);
 expect(await page.locator('#moves .mini').count()).toBe(await page.locator('#moves button').count());
 const graph=await page.locator('#eval-graph').boundingBox();await page.mouse.click(graph.x+2,graph.y+graph.height/2);await expect(page.locator('#ply')).toHaveText('Move 1');
 expect(errors).toEqual([]);await page.screenshot({path:'/tmp/openchess-review.png',fullPage:true});
});

test('Russian interface translates the page and move reviews and is remembered',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('#game-count')).toHaveText('750');
 await page.locator('[data-lang="ru"]').click();
 await expect(page.locator('html')).toHaveAttribute('lang','ru');await expect(page.locator('[data-lang="ru"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.nav[data-mode="practice"]')).toContainText('Партии мастеров');await expect(page.locator('#title')).toContainText('Великие партии.');
 await expect(page.locator('#review-title')).toHaveText(/ — (блестящий ход|отличный ход|лучший ход|превосходный ход|хороший ход|ход по теории|вынужденный ход|неточность|ошибка|промах|зевок)$/,{timeout:45000});
 await expect(page.locator('#review-text')).toHaveText(/[а-яё]{4}/);await expect(page.locator('#engine-state')).toContainText('глубина',{timeout:45000});
 await expect(page.locator('#turn')).toHaveText(/^Ход (белых|чёрных)/);await expect(page.locator('#board-message')).toHaveText(/^Найдите лучший ход за (белых|чёрных)\.$/);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','ru');await expect(page.locator('#crumb')).toHaveText('Партии мастеров');
 await page.locator('.nav[data-mode="bot"]').click();await expect(page.locator('#crumb')).toHaveText('Игра с ботом');await expect(page.locator('#new-bot')).toHaveText('Начать новую партию →');await expect(page.locator('#white-name')).toHaveText('Вы');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.locator('.nav[data-mode="drills"]').click();await expect(page.locator('#crumb')).toHaveText('Матовые задачи');await expect(page.locator('#drill-title')).toHaveText(/^Ход (белых|чёрных) · мат в [345] (хода|ходов)$/,{timeout:30000});
 await page.locator('.nav[data-mode="bot"]').click();
 await page.locator('[data-lang="en"]').click();await expect(page.locator('#crumb')).toHaveText('Play a bot');await expect(page.locator('#white-name')).toHaveText('You');
 expect(errors).toEqual([]);
});

test('checkmate drill: solve a position, miss another, replay the solution and pick new ones',async({page,request})=>{
 test.setTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {puzzles}=await (await request.get('/data/puzzles.json')).json();
 const [id,,moves]=puzzles.find(p=>p[4]===3&&p[2].split(' ').every(m=>m.length===4)),list=moves.split(' ');
 await page.goto('/#drill-'+id);await expect(page.locator('#drill-title')).toHaveText(/^(White|Black) to move · mate in 3$/,{timeout:30000});
 await expect(page.locator('#drill-source')).toHaveAttribute('href','https://lichess.org/training/'+id);await expect(page.locator('.line')).toHaveCount(0);
 await expect(page.locator('#engine-toggle')).toBeDisabled();await expect(page.locator('#drill-heading')).toHaveText('Your turn',{timeout:20000});await expect(page.locator('#drill-plays')).toContainText('Played');await expect(page.locator('#drill-next')).toBeHidden();
 for(let i=1;i<list.length;i+=2){await expect(page.locator('#hint')).toBeEnabled({timeout:20000});await page.locator(`[data-square="${list[i].slice(0,2)}"]`).click();await page.locator(`[data-square="${list[i].slice(2,4)}"]`).click();}
 await expect(page.locator('#drill-status')).toHaveText('Solved',{timeout:20000});await expect(page.locator('#board-message')).toContainText('Checkmate! Solved in 3 moves');
 await expect(page.locator('#turn')).toHaveText('Checkmate');await expect(page.locator('#drill-solved')).toHaveText('1');await expect(page.locator('#drill-streak')).toHaveText('1');
 await expect(page.locator('#drill-heading')).toHaveText('Success!');await expect(page.locator('#drill-next')).toBeVisible();await expect(page.locator('#drill-history .chip-ok')).toHaveCount(1);await expect(page.locator('#moves .mark.ok')).toHaveCount(3);await expect(page.locator('#engine-toggle')).toBeEnabled();
 // A quiet pawn move instead of the solution lets the opponent escape.
 const [id2,fen2,moves2]=puzzles.find(p=>p[4]===4&&p[0]!==id),chess=new Chess(fen2),first=moves2.split(' ');chess.move({from:first[0].slice(0,2),to:first[0].slice(2,4),promotion:first[0][4]});
 const quiet=chess.moves({verbose:true}).find(m=>m.lan!==first[1]&&m.piece==='p'&&!m.captured&&!m.promotion&&!/[+#]/.test(m.san))||chess.moves({verbose:true}).find(m=>m.lan!==first[1]&&!m.captured&&!/[+#]/.test(m.san));
 await page.goto('/?again#drill-'+id2);await expect(page.locator('#drill-title')).toHaveText(/mate in 4$/,{timeout:30000});await expect(page.locator('#hint')).toBeEnabled({timeout:20000});
 await page.locator(`[data-square="${quiet.from}"]`).click();await page.locator(`[data-square="${quiet.to}"]`).click();
 await expect(page.locator('#drill-status')).toHaveText('Not solved',{timeout:30000});await expect(page.locator('#board-message')).toContainText('Solution:');await expect(page.locator('#drill-heading')).toHaveText('Puzzle failed');await expect(page.locator('#moves .mark.fail')).toHaveCount(1);await expect(page.locator('#drill-history .chip-fail')).toHaveCount(1);
 await expect(page.locator('#drill-solved')).toHaveText('1');await expect(page.locator('#drill-streak')).toHaveText('0');await expect(page.locator('.line')).not.toHaveCount(0,{timeout:20000});
 await page.locator('#drill-solution').click();await expect(page.locator('#turn')).toHaveText('Checkmate',{timeout:20000});
 const shown=await page.locator('#drill-source').getAttribute('href');await page.locator('#drill-next').click();await expect(page.locator('#drill-source')).not.toHaveAttribute('href',shown);
 await page.locator('[data-length="5"]').click();await expect(page.locator('#drill-title')).toHaveText(/mate in 5$/);await expect(page.locator('[data-length="5"]')).toHaveAttribute('aria-pressed','true');
 expect(errors).toEqual([]);
});
