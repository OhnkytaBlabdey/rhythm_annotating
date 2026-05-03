# sticky 工具栏未紧贴视口顶部 — 问题诊断与修复

## 问题现象

`class="sticky top-0 z-50 flex"` 的工具栏预期紧贴视口顶部，但实际上紧贴着 `.editor-shell.flex.flex-col` 的顶部。`.editor-shell` 和 `.WorkArea` 之间存在缝隙，滚动页面时这部分没有固定。

## 根因

两个来源的间隙叠加导致工具栏到视口顶部有约 28px 的"死角"：

### 1. body 默认 8px margin（用户代理样式表）

`globals.css` 的 `body` 规则只设置了 `min-height`、`background`、`color`、`font-family`，没有 `margin: 0`。浏览器默认 8px margin 在视口顶部和 `.WorkArea` 之间创造可见间隙。

### 2. `.editor-shell` 的 20px padding-top

```css
.editor-shell {
  min-height: 100vh;
  padding: 20px 18px 36px;  /* 顶部 20px */
}
```

这 20px 顶部内边距在 `.editor-shell` 上边缘和 sticky 工具栏之间创造了第二个间隙。工具栏需要先滚过这 20px 才能到达视口顶部，视觉效果就是工具栏上方始终有段没被固定的间隙。

## 修改

### `src/app/globals.css`

- `body` 规则添加 `margin: 0`，消除浏览器默认外间距
- `.editor-shell` padding 改为 `padding: 0 18px 36px`，移除顶部内边距

### `src/components/workArea.tsx`

- 第 567 行 sound lanes 容器：`py-2` → `pt-5 pb-2`  
  `pt-5` = 20px，承接原来 `.editor-shell` 的 20px 顶部 padding，保持 toolbar 与 lanes 区间距不变

## 修改前后布局对比

```
修改前:
body (margin: 8px)
  WorkArea
    editor-shell (padding: 20px 18px 36px)
      [20px padding gap — 不随 sticky 固定]
      sticky toolbar (top: 0)
      lanes (py-2)

修改后:
body (margin: 0)
  WorkArea
    editor-shell (padding: 0 18px 36px)
      sticky toolbar (top: 0, 紧贴视口顶部)
      lanes (pt-5 pb-2)
```
