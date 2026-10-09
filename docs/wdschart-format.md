# 原生 WDSCHART 5 导出

## 目标与使用入口

本功能导出 **TeamOpenSirius/wds-editor** 的未加密原生 `.wdschart`，固定核对版本：

[`a3bfa45b907682722a5334270bd1e09f143e6fad`](https://github.com/TeamOpenSirius/wds-editor/tree/a3bfa45b907682722a5334270bd1e09f143e6fad)。

界面入口：WDS 谱面的导出弹窗中选择 **WDSCHART (.wdschart)**。
转换入口为 `src/lib/wdsChartExport.ts`：

```ts
export interface WdsChartExportResult {
    text: string;
    error: string | null;
    warnings: string[];
}

export function convertToWdsChart(lane: NoteLaneData): WdsChartExportResult;
```

调用方必须先检查 `error`，成功后将 `text` 以无 BOM 的 UTF-8 文本下载为 `.wdschart`，并展示 `warnings`。
失败时 `text` 始终为空。函数先执行 `validateNoteLaneData`，仅接受 `chartKind: "wds"`，不修改输入。
TXT 导出的规格另见 [wds-format.md](./wds-format.md)；本功能没有更改 TXT 或内部存储模型。

本地模型基线为 `23c513f5d4bc5978d293dbd494b995aa0f2ee218`：每个头键是一条独立点记录；长条仅包含身子和尾巴。
导出不由长条类型生成头键，也不改写、合并或重新配对已有头键。82、83 均可独立搭配 110；不强制 110→82、111→83。

## 目标源码事实

以下链接均固定到上述目标 commit，而非同名项目或浮动分支。

| 证据 | 位置与事实 |
| --- | --- |
| [原生序列化器](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/chart_serializer.cpp#L88-L331) | `core/src/chart_serializer.cpp:88–126` 写文本，`128–331` 读文本。V5 的 N 行含父长条 ID；保存过滤 900，加载也丢弃 900。 |
| [版本声明](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/include/wds/core/chart_serializer.hpp#L25-L41) | `core/include/wds/core/chart_serializer.hpp:25–41`：写 V5、读 V1–V5。 |
| [文件写入](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/file_io.cpp#L212-L253) | `core/src/file_io.cpp:212–253` 原样写入字节并原子替换；原生路径没有压缩、加密或校验和封装。 |
| [字段数据类](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/include/wds/core/notation.hpp#L18-L96) | `core/include/wds/core/notation.hpp:18–96` 定义 TimingPoint、MusicTiming、NotationNote、ConcurrentLineNote。TPQ 上限为 `INT32_MAX / 128`。 |
| [类型枚举](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/include/wds/core/types.hpp#L9-L69) | `core/include/wds/core/types.hpp:9–69`：原生枚举没有 40，有 30/31/50/80–83/100/101/110/111/200/900 等。 |
| [官方 40 导入](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/official_chart.cpp#L156-L199) | `core/src/official_chart.cpp:156–199`：40 在紫色长条开放区间中切段，找不到则转为 Flick；原实现选择首个重叠候选。 |
| [官方方向转换](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/official_chart.cpp#L330-L385) | 同文件 `330–385`：瞬时记录可使用 end=start；Flick OneDirection 转为原生 gimmick=0、signed width。 |
| [端盖范围](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/gimmick.cpp#L110-L143) | `core/src/gimmick.cpp:110–143`：所有链式长条都按 scratch_length 求端盖范围，包括 gimmick 为 0/2 的长条。 |
| [方向实际消费者](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/ui/src/regions/edit/chart_edit_renderer.cpp#L83-L106) | `ui/src/regions/edit/chart_edit_renderer.cpp:83–106`：只有 Flick 使用 OneDirection 的 0/1 兼容分支；长条使用普通符号分支。 |
| [箭头符号规则](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/chart-render/include/wds/chart_render/note_visual_policy.hpp#L83-L101) | `chart-render/include/wds/chart_render/note_visual_policy.hpp:83–101`：负数向左、正数向右、0 双向。 |
| [星星推断绑定](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/note_edit_ops.cpp#L24-L40) | `core/src/note_edit_ops.cpp:24–40, 656–676`：同类型家族、严格开放区间、完全相同 lane/width；未绑定时取首个候选。 |
| [可编辑加载](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/chart_editor_engine.cpp#L15-L64) | `core/src/chart_editor_engine.cpp:15–19, 54–64`：重建半拍 900，调用旧头键修复。 |
| [Timing 规范化](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/timing_map.cpp#L52-L164) | `core/src/timing_map.cpp:52–164`：tick 0 根点、排序合并、BPM 最大 10000、按 BPM 分段累计毫秒。 |

## 文件结构

```text
WDSCHART 5
BPM 120
TPQ 480
TIMING 1
T 0 120 4 4 3
NOTES 1
N 0 480 0 10 0 2 0 0 -1
CONCURRENT 0
END
```

这是一条位于第 1 拍（120 BPM 时为 500 ms）、覆盖目标逻辑轨道 0–1 的普通键。
实际返回文本末尾含换行；不写 BOM、注释、自定义字段或 `OFFSET_MS`。

### T 行

```text
T tick bpm numerator denominator flags
```

- tick、拍号为整数，bpm 为正有限浮点数；小数点使用 `.`。
- flags 的 bit 0 表示 BPM，bit 1 表示拍号。根点写 `3`，后续 BPM 变化写 `1`。
- 内部没有拍号信息，全部写 `4 4`，即每四个内部拍为一个 4/4 小节。
  内部名为 `measure` 的对象实际是一拍，不能当成四拍小节放大时间。

### N 行

```text
N id start_tick end_tick type lane width gimmick_type scratch_length parent_hold_id
```

- 九个字段均为整数。瞬时记录统一写 `end_tick=0`，长条写绝对终点 tick。
- 本地 1-based 的 lane 转为目标 0-based，width 原样保留。范围为 12 条逻辑轨道。
- ID 按整数 tick、跨度、类型、机制及源字符串 ID 的确定性顺序重新编号为 `0..N-1`。
  不依赖输入数组内相同拍位记录的顺序；后续父 ID 引用最终编号。
- 无父长条时写 `-1`。独立头键不使用父 ID 配对。
- `CONCURRENT 0` 由目标加载后的 `ChartDocument` 生成同时押连接线。
  该行为见 [`core/src/notation.cpp:634–710, 914–943`](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/notation.cpp#L914-L943)。

## 拍位精度、BPM 与 offset

这些是本导出器的实现决策：

1. 对要保存的 head/tail 分数用 BigInt 归约，先计算分母的**最小 LCM**。
   40 的切段时刻也参与精度计算；不保存的边界、body 锚点和 900 不参与 TPQ。
   若最小 LCM 与 480 的 LCM 能同时满足 TPQ 与 int32 tick 上限，优先采用它；否则选满足上限的最小偶数倍数，
   保留目标半拍网格；若只能使用合法奇数 LCM，仍精确输出已有拍位，并明确警告目标半拍判定的整数取整差异。
   480 是优先网格，不是格式硬约束：`1/65537` 可用 TPQ 131074，不能因 `480×65537` 超限而拒绝。
   长谱面也可使用较小的精确 TPQ 避免无谓的 tick 溢出。
2. 绝对拍位是 `所属拍索引 + 分数`。tail 和 head 均相对同一个所属拍起点，tail 不是相对 head 的时长。
3. 转换全程不使用 `division`、浮点 beat/time 的排序精度或静默四舍五入。
   例如 `2/960` 先归约为 `1/480`，不会无谓提升 TPQ；`1/7` 可精确提升为 TPQ 3360。
4. 只有最小分母 LCM 超过 `16777215`，或连最小精确 TPQ 都会使音符/变化点 tick 超过 `2147483647`，
   才按相应上限明确返回错误，不拒绝可由较小合法 TPQ 精确表示的拍位。
5. BPM map 从 segment 顺序与各段拍数重建，不使用存储的 `segment.time`。
   空段不产生时间区间，相邻等速段合并。存储拍数结束后，若最后 BPM 与 defaultBpm 不同，
   在结束拍加入 defaultBpm 变化点，完整保留模型的末尾延拓；空谱面以 defaultBpm 建根点。
6. defaultBpm 或任何 segment BPM 大于 10000 都报错，避免目标加载时截断 BPM。
7. 检查实际输出的全部 timing points，以及音符最大 start/end tick 的**累计毫秒时间**。
   按有序 BPM map 单次扫描积分，复杂度为 O(音符数 + 变化点数)，覆盖音符结束后的已存变化点和 defaultBpm 延拓。
   不为正常 BPM 任意设下限，但目标 double 运算结果若非有限，或达到 int64 的浮点饱和边界 `2^63`，明确报错。
   该边界必须按排他的 `2^63` 比较：把 `INT64_MAX=9223372036854775807` 转成 JS Number/C++ double 会向上舍入，
   不能将这个舍入后的值当成可安全转回 int64 的最大值。
8. 每个 NOTES/TIMING 集合最多 100 万记录；转换后的重复记录和无法确定归属的记录报错，不丢弃或任选一个。

**文件只保存谱面本地拍位。** `lane.wdsOffset` 是现有 TXT 的秒数偏移，本转换不应用它；非零时给出明确 warning。
目标原生读取器在 `chart_serializer.cpp:169–173` 接受后直接丢弃遗留 `OFFSET_MS`，因此不能借该字段存储 TXT 偏移。
本功能不修改 offset 模型，也不生成或要求 `.wdsproject`；音频和其他工程元信息均不在输出中。

精确 tick 不等于目标预览有无限时间精度。目标的 [`core/src/notation.cpp:151–183`](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/notation.cpp#L151-L183)
在播放/判定时间换算中使用整数毫秒；极近时刻可能在目标预览中合并，这不是本导出器对拍位进行了量化。
同文件 [`27–43`](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/notation.cpp#L27-L43)
还会将越界时间饱和到 int64 极值。例如 BPM `4e-307`、半拍点的拍位可精确编码，但目标毫秒运算溢出，
现在返回明确错误；文件可被读取并不代表其目标时间有效。

**目标再次保存的 BPM 精度限制：**其 [`chart_serializer.cpp:93–103`](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/chart_serializer.cpp#L93-L103)
使用默认 `std::ostringstream` 浮点精度，BPM 仅输出 **6 位有效数字**（不是小数点后六位）。
独立交叉审查确认首次加载和内存规范化保留 `123.456789 / 234.567891 / 90.123456789`，
目标重存、重读后则为 `123.457 / 234.568 / 90.1235`。这会改变之后的时间映射，甚至使相近 BPM 合并。
本导出器仍输出本地完整 Number 精度，不预先降低 BPM 精度；首次读取保真与目标重存后的精度必须区分。

## 本地记录到目标记录的映射

| 本地记录 | 导出行为 |
| --- | --- |
| 10、20、50、80、81、82、83、200 | 保留类型与独立记录。无需也不会依据长条编码合成头键。 |
| 100、101、110、111 | 保留本体类型与起止拍位，尾属性写到该记录；不创建额外尾记录。 |
| 30、31 | 原类型输出；分别在普通家族 100/101、紫色家族 110/111 中寻找父本体。 |
| 40，唯一匹配紫色长条内部 | 必须严格位于开放区间且 lane/width 完全相同；切分本体，前段尾表达 40 的方向/跨度，原长条尾属性保留在最后一段。连续多个 40 依次切段；没有新头键。 |
| 40，没有开放区间内重叠的紫色长条 | 按目标官方导入的孤立事件路径转为 50，提示外观差异。普通方向或 OneDirection 可明确转换；孤立的扩展 JumpScratch 会报错，因为目标官方孤立路径会清 gimmick，无法保证无损。 |
| 40，多个紫色候选或唯一候选范围不一致 | 明确报错。目标官方导入原本任选首个/沿用本体跨度，本导出器不进行这种猜测。 |
| 900 | 不写出；提示手工判定时刻丢失。目标原生格式的保存/加载都会过滤 900。 |
| 边界 -1/-2 | `collectWdsNotes` 排除，绝不将它们当成目标 HiSpeed/其他音符；也不裁剪音符或 BPM map。 |

不扩展内部类型列表，不生成 1100 等本地未支持的类型。

### 划动与 JumpScratch

先使用现有 `normalizeWdsJumpScratch` 处理本地等宽 JumpScratch；按当前本地模型将其清为普通无方向尾。

- gimmick=0：输出 scratch_length=0。本地无机制时的无效非零值忽略并警告，
  避免目标把它解释为有方向 Flick 或扩展长条尾。
- OneDirection：本地值 `0` 为左、**任何非零值**为右，转换为 `-width/+width`。
  Flick/孤立 40 转出的 Flick 用 `gimmick=0`；长条保留 `gimmick=2`。
  不能把 `0/1` 当长度，否则宽长条会错误缩成一列，左向还可能变成双向。
- JumpScratch：`gimmick=1`，保留 signed 覆盖宽度。设目标 `L=lane, R=lane+width-1, s=scratch_length`：
  - `s>0` 覆盖 `[L,L+s-1]`；
  - `s<0` 覆盖 `[R+s+1,R]`；
  - `s=0` 为本体范围，无方向。
- 40 转成的中间本体尾使用同样的 signed span；非零为 gimmick=1，双向为 0/0。
  这是在目标分段结构上的语义转换，避免照抄官方 40 导入器对 OneDirection 原始 0/1 的长度误解。
- 原生 50 上的 JumpScratch 数值可保存并经官方导出保留；但目标编辑绘图器
  [`chart_edit_renderer.cpp:150–170`](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/ui/src/regions/edit/chart_edit_renderer.cpp#L150-L170)
  对非长条仍按原 lane/width 绘制。因此这类 50 会额外提示目标视图可能不显示扩展覆盖。

### Sound 绑定

在 40 切段完成、ID 分配完成后，对 30/31 匹配：同家族、同 lane/width、`start < star < end`。
唯一候选写 parent_hold_id；多个候选报错；无候选写 -1 并警告。
目标不会在原生加载时删除无父记录，但其预览连击计算会对无父星星按重叠轨道尝试吸收，
并把未吸收记录作为独立判定，见 [`core/src/notation.cpp:486–608`](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/notation.cpp#L486-L608)。

## 已知目标差异与信息损失

- 目标对**所有普通及紫色长条**从每段起点按 `max(1, floor(TPQ/2))` tick 重建 900，已有可见星星占据的时刻除外；
  即使本地 autoTicks 关闭，也会发生。这可能改变判定点/连击，40 切段还会改变后续半拍序列的起点。
  偶数 TPQ 时步长精确为半拍；奇数 TPQ 时整数除法会偏离半拍，输出会给出专门 warning，已有音符拍位仍精确。
  本导出器不生成 900，也不引入内部自动 ticks 规则，显式 900 和 autoTicks 会各自触发说明。
  依据 [`core/src/note_edit_ops.cpp:43–110`](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/note_edit_ops.cpp#L43-L110)。
- 导出的独立头键原样保留。不过目标可编辑加载器会将与紫色本体同起点、同范围的 10/20/200
  作为旧头键重解释为 82/83；检测到这种布局时给出 warning，导出器自身不执行这种修复。
  依据 [`core/src/note_edit_ops.cpp:232–269, 424–440`](https://github.com/TeamOpenSirius/wds-editor/blob/a3bfa45b907682722a5334270bd1e09f143e6fad/core/src/note_edit_ops.cpp#L424-L440)。
- 原始字符串 ID、注释、body 锚点、边界、division、autoTicks、其他编辑辅助设置和音频/元信息不保存。
  body 不变成额外音符，边界不裁剪输出。原始内部 JSON/项目仍是可逆备份。
- 文件没有拍号来源，固定 4/4 是导出约定，不是从源谱面推断得到的拍号。
- 原生文件里没有连续曲线或插值控制点字段；当前导出仅映射已有独立记录及明确可转换的 40 分段。

## 验证范围

源码事实来自上述固定版本的读写、编辑和消费者实现；转换约定及严格拒绝策略属于本项目实现决策。
临时自检均放在 `/tmp/opencode`，不向仓库添加持久化 agent 测试。以下是实现阶段的自检记录：

- `pnpm lint`、`pnpm exec tsc --noEmit --incremental false --pretty false`、Web 与 desktop renderer 构建通过。
- 转换自检通过 28 组场景，含 100 个精确分数用例，覆盖输入不可变、完整 BPM map、独立头键、40 分段、
  星星归属、方向/覆盖、TPQ 回退及 tick/累计毫秒范围。
- 70 个生成用例通过真实上游 `ChartSerializer::load_from_file`；其中 67 个进一步经过上游可编辑核心处理、
  规范化、保存及重读，3 个超长长条仅检查读取。23 个不可表示或歧义场景按预期拒绝。
  使用实际上游 C++ 源码及 UBSan，无自写解析器替身；未发现非预期断言失败或 UBSan 报错。
- 开发服务、Web 静态产物、desktop renderer 静态产物分别通过 13 组浏览器流程自检，
  各完成 7 次真实下载，涵盖预览、UTF-8 字节、复制及 fallback、格式切换、错误禁用、偏移隔离和既有格式回归。

这些结果不表示目标无损重存：上游 BPM 的六位有效数字舍入仍会改变时间，极端边界甚至会令重读后的毫秒值饱和。
自检没有启动完整 Qt 编辑器，也没有覆盖 Electron `app://` 协议。用户在自己的浏览器中的验收仍需单独确认，
不能用 agent 自检结果代替。
