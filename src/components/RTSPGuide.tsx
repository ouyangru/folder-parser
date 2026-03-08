import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Network,
  Video,
  Shield,
  Layers,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Building2,
  Radio,
  Lock,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────
   Small helper: renders a mono-spaced "packet / code" block
   ──────────────────────────────────────────────────────────── */
function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="my-3 rounded-lg overflow-hidden border border-gray-200">
      {title && (
        <div className="bg-gray-700 text-gray-200 text-xs px-4 py-1 font-mono">{title}</div>
      )}
      <pre className="bg-gray-900 text-green-300 text-xs leading-relaxed overflow-x-auto p-4 whitespace-pre">
        {children.trim()}
      </pre>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Section wrapper
   ──────────────────────────────────────────────────────────── */
function Section({
  id,
  icon,
  title,
  badge,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
          {badge && <Badge variant="outline" className="ml-2 text-xs">{badge}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="prose prose-sm max-w-none text-gray-700 space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════════ */
export function RTSPGuide() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">

      {/* ── 目录 ── */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800 text-base">📋 本文目录</CardTitle>
          <CardDescription className="text-blue-700">
            RTSP 协议完整讲解 · 适合初学者系统阅读
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li><a href="#overview" className="hover:underline">RTSP 协议概述</a></li>
            <li><a href="#flow" className="hover:underline">通信流程（OPTIONS → TEARDOWN）</a></li>
            <li><a href="#pushpull" className="hover:underline">音视频推流 / 拉流</a></li>
            <li><a href="#rtp-rtcp" className="hover:underline">RTP / RTCP 与 RTSP 的关系</a></li>
            <li><a href="#client-server" className="hover:underline">VLC / FFplay 抓包示例</a></li>
            <li><a href="#pros-cons" className="hover:underline">优缺点 · 典型行业</a></li>
            <li><a href="#rtsps" className="hover:underline">拓展：RTSPS 安全传输</a></li>
          </ol>
        </CardContent>
      </Card>

      {/* ── 1. 概述 ── */}
      <Section id="overview" icon={<Network className="w-5 h-5 text-blue-600" />} title="1. RTSP 协议概述">
        <p>
          <strong>RTSP（Real Time Streaming Protocol，实时流协议）</strong> 是一种应用层协议，
          由 RFC 2326（1998）定义，用于在客户端与流媒体服务器之间建立和控制多媒体流会话。
          它本身<strong>并不传输</strong>音视频数据，而是充当「遥控器」的角色，控制流的播放、
          暂停、停止等动作。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <div className="text-2xl mb-1">🎛️</div>
            <div className="font-semibold text-blue-900 text-sm">RTSP</div>
            <div className="text-xs text-blue-700">控制信令（TCP 554）</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <div className="text-2xl mb-1">📦</div>
            <div className="font-semibold text-green-900 text-sm">RTP</div>
            <div className="text-xs text-green-700">媒体传输（UDP）</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-center">
            <div className="text-2xl mb-1">📊</div>
            <div className="font-semibold text-purple-900 text-sm">RTCP</div>
            <div className="text-xs text-purple-700">质量反馈（UDP）</div>
          </div>
        </div>

        <CodeBlock title="RTSP URL 格式">
{`rtsp://[用户名:密码@]主机[:端口]/路径

示例：
rtsp://admin:password@192.168.1.100:554/live/channel1
rtsp://streaming.example.com/vod/movie.mp4
rtsp://camera.local/h264Preview_01_main`}
        </CodeBlock>

        <p className="text-sm text-gray-600">
          默认端口 <Badge variant="outline">554</Badge>，协议格式与 HTTP/1.1 高度相似（方法、
          状态码、头字段），因此也被称为「面向流媒体的 HTTP」。
        </p>
      </Section>

      {/* ── 2. 通信流程 ── */}
      <Section
        id="flow"
        icon={<ArrowRightLeft className="w-5 h-5 text-indigo-600" />}
        title="2. RTSP 通信流程"
        badge="OPTIONS → TEARDOWN"
      >
        <p>
          一次完整的 RTSP 会话通常按以下顺序进行。每条请求都携带递增的
          <code className="bg-gray-100 px-1 rounded">CSeq</code> 序列号，用于匹配请求与响应。
        </p>

        {/* ASCII 流程图 */}
        <CodeBlock title="RTSP 会话完整时序图">
{`Client                                      Server
  |                                              |
  |──── OPTIONS rtsp://host/stream RTSP/1.0 ───>|  ① 查询服务器支持哪些方法
  |<─── 200 OK  Public: OPTIONS,DESCRIBE,... ───|
  |                                              |
  |──── DESCRIBE rtsp://host/stream RTSP/1.0 ──>|  ② 获取媒体描述（SDP）
  |<─── 200 OK  Content-Type: application/sdp ──|
  |     (SDP body: 编解码、端口、时间戳等信息)   |
  |                                              |
  |──── SETUP rtsp://host/stream/track1 ───────>|  ③ 协商传输参数（RTP/RTCP 端口）
  |     Transport: RTP/AVP;unicast;              |
  |                client_port=5000-5001         |
  |<─── 200 OK  Session: 12345678 ──────────────|
  |     Transport: ...;server_port=6000-6001     |
  |                                              |
  |──── PLAY rtsp://host/stream RTSP/1.0 ──────>|  ④ 开始播放
  |     Session: 12345678                        |
  |     Range: npt=0.000-                        |
  |<─── 200 OK  RTP-Info: ... ──────────────────|
  |                                              |
  |<══════════ RTP 音视频数据包持续传输 ══════════|  ⑤ 真正的媒体流（UDP/TCP）
  |<══════════ RTCP 统计报告双向交换 ════════════|
  |                                              |
  |──── PAUSE rtsp://host/stream RTSP/1.0 ─────>|  ⑥（可选）暂停
  |<─── 200 OK ─────────────────────────────────|
  |                                              |
  |──── TEARDOWN rtsp://host/stream RTSP/1.0 ──>|  ⑦ 终止会话
  |     Session: 12345678                        |
  |<─── 200 OK ─────────────────────────────────|`}
        </CodeBlock>

        <div className="space-y-3 mt-4">
          {[
            {
              cmd: 'OPTIONS',
              bg: 'bg-blue-50',
              badge: 'bg-blue-600',
              desc: '客户端探测服务器支持的方法列表。类似 HTTP OPTIONS，可选但推荐作为第一步。',
            },
            {
              cmd: 'DESCRIBE',
              bg: 'bg-indigo-50',
              badge: 'bg-indigo-600',
              desc: '获取流的 SDP（Session Description Protocol）描述，包含音视频轨道数量、编码格式、采样率、时间戳基准等元信息。',
            },
            {
              cmd: 'SETUP',
              bg: 'bg-violet-50',
              badge: 'bg-violet-600',
              desc: '针对每条媒体轨道协商传输方式（UDP 单播/组播 或 TCP Interleaved）及 RTP/RTCP 端口号。服务器返回 Session ID，后续请求都需携带。',
            },
            {
              cmd: 'PLAY',
              bg: 'bg-green-50',
              badge: 'bg-green-600',
              desc: '命令服务器开始发送 RTP 数据包。可使用 Range 头指定播放起始时间（NPT/SMPTE/绝对时间）。',
            },
            {
              cmd: 'PAUSE',
              bg: 'bg-yellow-50',
              badge: 'bg-yellow-600',
              desc: '暂停数据流，但保留 Session。再次发送 PLAY 可续播。',
            },
            {
              cmd: 'TEARDOWN',
              bg: 'bg-red-50',
              badge: 'bg-red-600',
              desc: '释放会话资源，服务器停止发送数据并销毁 Session。',
            },
          ].map(({ cmd, bg, badge, desc }) => (
            <div key={cmd} className={`flex gap-3 p-3 ${bg} rounded-lg`}>
              <Badge className={`${badge} text-white shrink-0 h-fit`}>{cmd}</Badge>
              <p className="text-sm text-gray-700">{desc}</p>
            </div>
          ))}
        </div>

        <h3 className="font-semibold text-gray-800 mt-6 mb-2">📨 典型报文示例</h3>

        <CodeBlock title="DESCRIBE 请求报文">
{`DESCRIBE rtsp://192.168.1.100:554/live/ch1 RTSP/1.0
CSeq: 2
User-Agent: LibVLC/3.0.18
Accept: application/sdp`}
        </CodeBlock>

        <CodeBlock title="DESCRIBE 响应（含 SDP）">
{`RTSP/1.0 200 OK
CSeq: 2
Content-Base: rtsp://192.168.1.100:554/live/ch1/
Content-Type: application/sdp
Content-Length: 460

v=0
o=- 1678886400 1 IN IP4 192.168.1.100
s=Live Stream
t=0 0
a=tool:RTSP Server 1.0
m=video 0 RTP/AVP 96
a=rtpmap:96 H264/90000
a=fmtp:96 packetization-mode=1; profile-level-id=42C01E
a=control:track0
m=audio 0 RTP/AVP 97
a=rtpmap:97 MPEG4-GENERIC/44100/2
a=control:track1`}
        </CodeBlock>

        <CodeBlock title="SETUP 请求（协商 RTP 端口）">
{`SETUP rtsp://192.168.1.100:554/live/ch1/track0 RTSP/1.0
CSeq: 3
Transport: RTP/AVP;unicast;client_port=5000-5001
User-Agent: LibVLC/3.0.18`}
        </CodeBlock>

        <CodeBlock title="SETUP 响应（服务器分配端口 + Session ID）">
{`RTSP/1.0 200 OK
CSeq: 3
Session: A3B7C9D1;timeout=60
Transport: RTP/AVP;unicast;client_port=5000-5001;
           server_port=6000-6001;ssrc=0xDEADBEEF`}
        </CodeBlock>

        <CodeBlock title="PLAY 请求">
{`PLAY rtsp://192.168.1.100:554/live/ch1 RTSP/1.0
CSeq: 4
Session: A3B7C9D1
Range: npt=0.000-`}
        </CodeBlock>
      </Section>

      {/* ── 3. 推流 / 拉流 ── */}
      <Section
        id="pushpull"
        icon={<Video className="w-5 h-5 text-green-600" />}
        title="3. 音视频推流与拉流"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-green-200 rounded-lg bg-green-50">
            <h3 className="font-semibold text-green-800 mb-2">📥 拉流（Pull / 点播 / 监控）</h3>
            <p className="text-sm text-gray-700 mb-2">
              最常见的场景。<strong>客户端主动</strong>向服务器发送 DESCRIBE → SETUP → PLAY，
              服务器随后将 RTP 包推送给客户端。
            </p>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>VLC / FFplay 打开 rtsp:// 链接</li>
              <li>安防摄像头 NVR 拉流录制</li>
              <li>流媒体 CDN 回源拉取</li>
            </ul>
          </div>
          <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
            <h3 className="font-semibold text-blue-800 mb-2">📤 推流（Push / ANNOUNCE）</h3>
            <p className="text-sm text-gray-700 mb-2">
              编码端主动把流"推"给服务器。使用
              <code className="bg-white px-1 rounded">ANNOUNCE</code> 方法注册流，
              再用 <code className="bg-white px-1 rounded">RECORD</code> 开始推送。
              （RFC 2326 定义，部分服务器支持）
            </p>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>摄像头直接推流到流媒体服务器</li>
              <li>FFmpeg -f rtsp 推流</li>
              <li>编码器设备上报流</li>
            </ul>
          </div>
        </div>

        <CodeBlock title="推流流程（ANNOUNCE + RECORD）">
{`Client (摄像头/编码器)                 Server (流媒体服务器)
  |                                          |
  |── ANNOUNCE rtsp://host/live/cam1 ───────>|  注册流描述（SDP）
  |<── 200 OK ───────────────────────────────|
  |                                          |
  |── SETUP rtsp://host/live/cam1/track0 ──>|  协商端口
  |<── 200 OK  Session: XYZ ────────────────|
  |                                          |
  |── RECORD rtsp://host/live/cam1 ─────────>|  开始推流
  |<── 200 OK ───────────────────────────────|
  |                                          |
  |══ RTP 视频/音频数据 ═══════════════════>|  持续传输
  |                                          |
  |── TEARDOWN ─────────────────────────────>|  结束`}
        </CodeBlock>

        <CodeBlock title="FFmpeg 推流示例（命令行）">
{`# 将本地视频以 RTSP 推流到服务器
ffmpeg -re -i input.mp4 \
  -c:v copy -c:a copy \
  -f rtsp rtsp://192.168.1.200:554/live/stream1

# 从摄像头设备采集并推流（Linux V4L2）
ffmpeg -f v4l2 -i /dev/video0 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -f rtsp rtsp://192.168.1.200:554/live/cam`}
        </CodeBlock>

        <CodeBlock title="FFplay 拉流播放示例">
{`# 拉流播放（低延迟模式）
ffplay -rtsp_transport tcp rtsp://192.168.1.100:554/live/ch1

# 同时录制
ffmpeg -rtsp_transport tcp -i rtsp://192.168.1.100:554/live/ch1 \
  -c copy output.mp4`}
        </CodeBlock>
      </Section>

      {/* ── 4. RTP / RTCP ── */}
      <Section
        id="rtp-rtcp"
        icon={<Layers className="w-5 h-5 text-purple-600" />}
        title="4. RTP / RTCP 与 RTSP 的关系"
      >
        <p>
          RTSP 是"控制面"，RTP/RTCP 是"数据面"。三者协同工作，职责完全分离：
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">协议</th>
                <th className="border border-gray-300 px-3 py-2 text-left">作用</th>
                <th className="border border-gray-300 px-3 py-2 text-left">传输层</th>
                <th className="border border-gray-300 px-3 py-2 text-left">默认端口</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-3 py-2 font-mono font-bold text-blue-700">RTSP</td>
                <td className="border border-gray-300 px-3 py-2">流会话控制（建立/暂停/停止）</td>
                <td className="border border-gray-300 px-3 py-2">TCP</td>
                <td className="border border-gray-300 px-3 py-2">554</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-3 py-2 font-mono font-bold text-green-700">RTP</td>
                <td className="border border-gray-300 px-3 py-2">承载音视频媒体数据包</td>
                <td className="border border-gray-300 px-3 py-2">UDP（偶数端口）</td>
                <td className="border border-gray-300 px-3 py-2">动态分配（≥1024）</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-3 py-2 font-mono font-bold text-purple-700">RTCP</td>
                <td className="border border-gray-300 px-3 py-2">质量统计与同步反馈（SR/RR/SDES）</td>
                <td className="border border-gray-300 px-3 py-2">UDP（奇数端口 = RTP+1）</td>
                <td className="border border-gray-300 px-3 py-2">RTP 端口 + 1</td>
              </tr>
            </tbody>
          </table>
        </div>

        <CodeBlock title="协议栈层次结构">
{`┌─────────────────────────────────────────────────────────┐
│                     应用层                               │
│  ┌──────────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  RTSP（控制信令） │  │   RTP    │  │     RTCP      │  │
│  │  OPTIONS/DESCRIBE│  │ 音视频帧  │  │ SR/RR 统计报告│  │
│  │  SETUP/PLAY/...  │  │ 时间戳   │  │ 同步 · 丢包率 │  │
│  └────────┬─────────┘  └────┬─────┘  └──────┬────────┘  │
├───────────┼────────────────┼───────────────┼────────────┤
│           TCP              UDP             UDP           │
│           554            动态端口         RTP+1          │
└───────────────────────────────────────────────────────────┘`}
        </CodeBlock>

        <h3 className="font-semibold text-gray-800 mt-4 mb-2">RTP 包头格式（简化）</h3>
        <CodeBlock title="RTP 固定包头（12 字节）">
{` 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|V=2|P|X| CC  |M|     PT      |       Sequence Number          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                           Timestamp                           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|           Synchronization Source (SSRC) identifier           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

V=2    版本号
PT     载荷类型（96=H.264, 97=AAC, 8=PCMA ...）
Seq    序列号（检测丢包/乱序）
TS     时间戳（音视频同步关键）
SSRC   同步源标识符`}
        </CodeBlock>

        <h3 className="font-semibold text-gray-800 mt-4 mb-2">TCP Interleaved 模式</h3>
        <p className="text-sm text-gray-600">
          当 UDP 被防火墙封锁时，可在 SETUP 中使用{' '}
          <code className="bg-gray-100 px-1 rounded">Transport: RTP/AVP/TCP;interleaved=0-1</code>，
          将 RTP/RTCP 数据嵌入 RTSP TCP 连接中传输（以 <code className="bg-gray-100 px-1 rounded">$</code> 开头的二进制帧封装）。
        </p>
        <CodeBlock title="TCP Interleaved 帧格式">
{`$ | Channel(1B) | Length(2B) | RTP/RTCP Payload
  |      0      |   0x0492   | <RTP 包...>      ← 视频 RTP
  |      1      |   0x001C   | <RTCP 包...>     ← 视频 RTCP
  |      2      |   0x00D4   | <RTP 包...>      ← 音频 RTP`}
        </CodeBlock>
      </Section>

      {/* ── 5. VLC / FFplay 交互示例 ── */}
      <Section
        id="client-server"
        icon={<Radio className="w-5 h-5 text-orange-600" />}
        title="5. VLC / FFplay 与服务器交互示例"
      >
        <p>
          以下抓包信息来自 Wireshark，展示 VLC 打开安防摄像头 RTSP 流的完整过程。
        </p>

        <CodeBlock title="Wireshark 过滤器">
{`rtsp or rtp or rtcp`}
        </CodeBlock>

        <CodeBlock title="完整 VLC 抓包（简化版）">
{`No.  Time    Source            Destination       Protocol  Info
1    0.000   192.168.1.10      192.168.1.100     RTSP      OPTIONS rtsp://192.168.1.100/live/ch1 RTSP/1.0
2    0.003   192.168.1.100     192.168.1.10      RTSP      Reply: RTSP/1.0 200 OK  (OPTIONS)
3    0.004   192.168.1.10      192.168.1.100     RTSP      DESCRIBE rtsp://192.168.1.100/live/ch1 RTSP/1.0
4    0.010   192.168.1.100     192.168.1.10      RTSP      Reply: RTSP/1.0 200 OK  (DESCRIBE)
5    0.011   192.168.1.10      192.168.1.100     RTSP      SETUP rtsp://...track0 RTSP/1.0  [视频轨]
6    0.015   192.168.1.100     192.168.1.10      RTSP      Reply: RTSP/1.0 200 OK  (SETUP)
7    0.016   192.168.1.10      192.168.1.100     RTSP      SETUP rtsp://...track1 RTSP/1.0  [音频轨]
8    0.019   192.168.1.100     192.168.1.10      RTSP      Reply: RTSP/1.0 200 OK  (SETUP)
9    0.020   192.168.1.10      192.168.1.100     RTSP      PLAY rtsp://192.168.1.100/live/ch1 RTSP/1.0
10   0.023   192.168.1.100     192.168.1.10      RTSP      Reply: RTSP/1.0 200 OK  (PLAY)
11   0.024   192.168.1.100     192.168.1.10      RTP       PT=H264, Seq=1, TS=0
12   0.024   192.168.1.100     192.168.1.10      RTP       PT=H264, Seq=2, TS=0   (分片)
...  ...     ...               ...               RTP       持续视频帧
100  0.100   192.168.1.100     192.168.1.10      RTCP      Sender Report (SR)
101  0.101   192.168.1.10      192.168.1.100      RTCP      Receiver Report (RR): lost=0, jitter=2ms`}
        </CodeBlock>

        <CodeBlock title="VLC 命令行打开 RTSP 流">
{`# 播放并显示统计
vlc rtsp://192.168.1.100:554/live/ch1

# 低延迟模式（减少缓冲）
vlc rtsp://192.168.1.100:554/live/ch1 \
  --network-caching=200 \
  --rtsp-tcp

# 录制为 MP4
vlc rtsp://192.168.1.100:554/live/ch1 \
  --sout '#transcode{vcodec=h264,acodec=mp4a}:standard{access=file,mux=mp4,dst=output.mp4}'`}
        </CodeBlock>

        <CodeBlock title="FFplay 详细日志示例">
{`$ ffplay -v info rtsp://192.168.1.100:554/live/ch1

[rtsp @ 0x...] SDP:
v=0
o=- 16788864 1 IN IP4 192.168.1.100
m=video 0 RTP/AVP 96
a=rtpmap:96 H264/90000

[h264 @ 0x...] nal_unit_type: 7(SPS), nal_ref_idc: 3
Input #0, rtsp, from 'rtsp://192.168.1.100:554/live/ch1':
  Duration: N/A, start: 0.023413, bitrate: N/A
  Stream #0:0: Video: h264 (Baseline), yuv420p, 1920x1080, 25 fps
  Stream #0:1: Audio: aac, 44100 Hz, stereo, fltp`}
        </CodeBlock>

        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm">
          <strong>💡 常见问题：</strong> 若 RTSP 流无法拉通，优先尝试加{' '}
          <code className="bg-white px-1 rounded">-rtsp_transport tcp</code>（FFmpeg/FFplay）
          或 VLC 的 <code className="bg-white px-1 rounded">--rtsp-tcp</code>，
          绕过 UDP 端口被防火墙拦截的问题。
        </div>
      </Section>

      {/* ── 6. 优缺点 ── */}
      <Section
        id="pros-cons"
        icon={<Building2 className="w-5 h-5 text-teal-600" />}
        title="6. 优缺点与典型应用行业"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-green-700 mb-3">
              <CheckCircle className="w-4 h-4" /> 优点
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              {[
                '低延迟：UDP + RTP 裸传，端到端延迟可低至 200ms 以内',
                '成熟稳定：RFC 2326 标准化，20+ 年工程实践',
                '协议简单：类 HTTP 语法，便于调试和抓包分析',
                '媒体与控制分离：控制精细（精确 seek、多轨切换）',
                '支持组播：大规模分发时节省带宽',
                '广泛兼容：几乎所有 IP 摄像头、NVR、VMS 均支持',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-green-500 shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-red-700 mb-3">
              <XCircle className="w-4 h-4" /> 缺点
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              {[
                '防火墙穿透难：UDP 端口动态分配，企业网络常被封锁',
                '浏览器原生不支持：需借助插件或转协议（WebRTC/HLS）',
                '无内置加密：明文传输，需配合 SRTP/TLS 补全安全',
                '移动端穿墙复杂：NAT traversal 需额外处理',
                '适配成本高：推流需 ANNOUNCE/RECORD 支持，并非所有服务器实现',
                '正逐步被 SRT/WebRTC 替代于直播场景',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-red-500 shrink-0">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <h3 className="font-semibold text-gray-800 mt-6 mb-3">🏭 典型应用行业</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { icon: '🏗️', title: '安防监控', desc: 'IP 摄像头 → NVR → VMS，ONVIF 基于 RTSP' },
            { icon: '📡', title: '广播电视', desc: '演播室内部信号分发、编解码设备互联' },
            { icon: '🏥', title: '医疗影像', desc: '手术室实时视频传输（低延迟要求）' },
            { icon: '🚦', title: '交通管理', desc: '道路监控摄像头集中管理' },
            { icon: '🎓', title: '教育直播', desc: '录播系统将课堂流送往录像服务器' },
            { icon: '🏭', title: '工业物联网', desc: '机器视觉、远程巡检摄像头' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xl mb-1">{icon}</div>
              <div className="font-semibold text-sm text-gray-800">{title}</div>
              <div className="text-xs text-gray-500 mt-1">{desc}</div>
            </div>
          ))}
        </div>

        <h3 className="font-semibold text-gray-800 mt-6 mb-2">📊 与其他流媒体协议对比</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {['协议', '延迟', '浏览器支持', '加密', '穿墙', '典型场景'].map((h) => (
                  <th key={h} className="border border-gray-300 px-2 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['RTSP/RTP', '100ms~1s', '❌ 需插件', '需 SRTP', '困难', '安防监控、广播'],
                ['HLS', '5s~30s', '✅ 原生', '✅ HTTPS', '容易', 'CDN 点播/直播'],
                ['WebRTC', '<100ms', '✅ 原生', '✅ 强制', '中等', '视频会议、连麦'],
                ['SRT', '120ms~', '❌ 需应用', '✅ 内置', '中等', '跨公网推流'],
                ['RTMP', '1s~3s', '❌ 需 Flash', '需 RTMPS', '中等', '直播推流（历史）'],
              ].map((row) => (
                <tr key={row[0]} className="hover:bg-gray-50">
                  {row.map((cell, i) => (
                    <td key={i} className={`border border-gray-300 px-2 py-2 ${i === 0 ? 'font-semibold' : ''}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── 7. RTSPS ── */}
      <Section
        id="rtsps"
        icon={<Lock className="w-5 h-5 text-red-600" />}
        title="7. 拓展：RTSPS 安全传输"
        badge="TLS/SSL"
      >
        <p>
          <strong>RTSPS（RTSP over TLS）</strong> 是在 RTSP 下层叠加 TLS 隧道，
          类似 HTTP → HTTPS 的升级方式，默认端口 <Badge variant="outline">322</Badge>（有时也用 554）。
        </p>

        <CodeBlock title="RTSPS URL 示例">
{`rtsps://camera.example.com:322/live/ch1
rtsps://admin:pass@192.168.1.100:554/stream`}
        </CodeBlock>

        <div className="space-y-3">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">🔐 RTSPS 工作原理</h4>
            <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
              <li>客户端发起 TLS 握手（ClientHello → ServerHello → 证书验证）</li>
              <li>TLS 隧道建立后，RTSP 控制信令在加密通道内传输</li>
              <li>RTP/RTCP 媒体数据同样通过 TCP Interleaved 模式在 TLS 隧道中传输</li>
              <li>或使用 <strong>SRTP（Secure RTP）</strong> 单独对媒体数据加密</li>
            </ol>
          </div>

          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-800 mb-2">🛡️ 完整安全方案</h4>
            <CodeBlock title="信令 + 媒体双重加密">
{`控制信令加密：RTSPS（RTSP over TLS）
媒体数据加密：SRTP（RFC 3711）

SRTP 在 SETUP 时通过 key-mgmt 头或 DTLS 协商加密密钥：
SETUP rtsp://host/stream/track0 RTSP/1.0
Transport: RTP/SAVP;unicast;client_port=5000-5001
           ↑ SAVP = Secure Audio/Video Profile`}
            </CodeBlock>
          </div>

          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h4 className="font-semibold text-amber-800 mb-2">⚙️ FFmpeg 使用 RTSPS</h4>
            <CodeBlock title="">
{`# 播放 RTSPS 流（跳过证书验证，测试用）
ffplay -rtsp_transport tcp \
  -tls_verify 0 \
  rtsps://192.168.1.100:322/live/ch1

# 生产环境：指定 CA 证书
ffmpeg -ca_file /etc/ssl/certs/ca.crt \
  -i rtsps://camera.example.com/live/ch1 \
  -c copy output.mp4`}
            </CodeBlock>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg border text-sm text-gray-700">
          <strong>📌 安全建议：</strong> 在公网部署 RTSP 时，强烈建议启用 RTSPS + SRTP，
          并配合强口令认证（DIGEST 或 Bearer Token）。避免使用明文 rtsp:// 暴露在互联网上，
          防止视频流被窃听或设备遭未授权访问。
        </div>
      </Section>

      {/* ── 总结 ── */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Shield className="w-5 h-5" />
            核心知识总结
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {[
              { label: '协议定位', value: 'RTSP = 遥控器；RTP = 货车；RTCP = 反馈卡' },
              { label: '标准端口', value: 'RTSP: 554 · RTSPS: 322' },
              { label: '会话五步', value: 'OPTIONS → DESCRIBE → SETUP → PLAY → TEARDOWN' },
              { label: '推流方法', value: 'ANNOUNCE + RECORD（服务器需支持）' },
              { label: '穿墙方案', value: 'TCP Interleaved（-rtsp_transport tcp）' },
              { label: '安全方案', value: 'RTSPS（控制面）+ SRTP（媒体面）' },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <Badge variant="outline" className="shrink-0 h-fit">{label}</Badge>
                <span className="text-gray-700">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
