// 在浏览器控制台运行此脚本来调试地理位置功能

// 1. 检查编辑器元素和 storeInstance
function debugEditorStore() {
  console.log('=== Debug Editor Store ===');

  // 查找 global-editor 元素
  const globalEditor = document.getElementById('global-editor');
  console.log('global-editor:', globalEditor);

  if (globalEditor) {
    console.log('global-editor.children:', globalEditor.children);
    console.log('global-editor.children.length:', globalEditor.children.length);

    // 遍历所有子元素，查找 __storeInstance
    for (let i = 0; i < globalEditor.children.length; i++) {
      const child = globalEditor.children[i];
      console.log(`child[${i}]:`, child);
      console.log(`child[${i}].__storeInstance:`, (child as any).__storeInstance);

      // 递归查找所有子元素中的 __storeInstance
      const allElements = child.querySelectorAll('*');
      console.log(`child[${i}] has ${allElements.length} descendant elements`);

      allElements.forEach((el, idx) => {
        if ((el as any).__storeInstance) {
          console.log(`  Found __storeInstance at descendant[${idx}]:`, el);
          console.log(`  Store instance:`, (el as any).__storeInstance);
          console.log(`  Has insertMarkdown:`, typeof (el as any).__storeInstance?.insertMarkdown === 'function');
        }
      });
    }
  }
}

// 2. 测试插入文本功能
function testInsertText() {
  console.log('=== Test Insert Text ===');

  // 查找带有 __storeInstance 的元素
  const globalEditor = document.getElementById('global-editor');
  if (globalEditor) {
    const allElements = globalEditor.querySelectorAll('*');
    let found = false;

    allElements.forEach((el) => {
      if ((el as any).__storeInstance) {
        found = true;
        const storeInstance = (el as any).__storeInstance;
        console.log('Found storeInstance:', storeInstance);
        console.log('Has vditor:', !!storeInstance.vditor);
        console.log('Has insertMarkdown:', typeof storeInstance.insertMarkdown === 'function');

        // 尝试插入测试文本
        if (typeof storeInstance.insertMarkdown === 'function') {
          console.log('Attempting to insert test text...');
          storeInstance.insertMarkdown('\\n📍 测试位置\\n');
          console.log('Insert attempt completed');
        } else if (storeInstance.vditor) {
          console.log('Attempting to insert via vditor...');
          storeInstance.vditor.insertValue('\\n📍 测试位置 (via vditor)\\n');
          console.log('Insert via vditor completed');
        }
      }
    });

    if (!found) {
      console.error('No element with __storeInstance found!');
    }
  }
}

// 3. 检查 eventBus
function debugEventBus() {
  console.log('=== Debug Event Bus ===');

  // 触发打开位置选择器
  if (typeof window !== 'undefined' && (window as any).eventBus) {
    console.log('EventBus found:', (window as any).eventBus);
    (window as any).eventBus.emit('editor:openLocationPicker');
    console.log('Fired editor:openLocationPicker event');
  } else {
    console.error('EventBus not found on window object');
  }
}

// 导出函数供控制台使用
window.debugEditorStore = debugEditorStore;
window.testInsertText = testInsertText;
window.debugEventBus = debugEventBus;

console.log('Debug functions loaded!');
console.log('Available commands:');
console.log('  debugEditorStore() - 检查编辑器元素和 storeInstance');
console.log('  testInsertText() - 测试插入文本功能');
console.log('  debugEventBus() - 触发打开位置选择器事件');
