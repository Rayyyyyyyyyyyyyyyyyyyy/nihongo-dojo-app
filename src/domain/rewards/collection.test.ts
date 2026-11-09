import { collectionBoard } from './index';

const keys = ['a', 'b', 'c'].map((id) => JSON.stringify(['N3', 'vocab', id]));

describe('收集冊點亮（rewards §7）', () => {
  test('只點亮既有掌握判定為已掌握的札，顯示已掛／總數', () => {
    const mastered = new Set([keys[0], keys[2]]);
    expect(collectionBoard(keys, (k) => mastered.has(k))).toEqual({ lit: [keys[0], keys[2]], total: 3 });
  });

  test('掌握被錯題重設後札變回輪廓（收集冊沒有自己的完成紀錄）', () => {
    const mastered = new Set([keys[0]]);
    expect(collectionBoard(keys, (k) => mastered.has(k)).lit).toEqual([keys[0]]);
    mastered.delete(keys[0]);
    expect(collectionBoard(keys, (k) => mastered.has(k)).lit).toEqual([]);
  });
});
