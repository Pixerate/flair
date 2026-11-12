// flair-metal-hash: 1ce6947c
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float3 uColor;
    packed_float3 uCore;
    float uSpan;
    float uY;
    float uCurve;
    float uRise;
    float uWidth;
    float uGlow;
    uint uSecond;
    uint uAnimate;
    float uCycle;
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_swoosh_underline_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _160)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_160.iResolution[0u], _160.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_160.iResolution[0], _160.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _194;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _194 = s.y;
    }
    else
    {
        float _203;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _203 = s.x;
        }
        else
        {
            float _213;
            if (meta.w < 1.5)
            {
                _213 = fast::min(s.x, s.y);
            }
            else
            {
                _213 = fast::max(s.x, s.y);
            }
            _203 = _213;
        }
        _194 = _203;
    }
    float k = _194;
    return float3((float2(_160.iResolution[0], _160.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _160)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _160).z;
}

static inline __attribute__((always_inline))
float easeOut(thread const float& x)
{
    return 1.0 - powr(1.0 - fast::clamp(x, 0.0, 1.0), 3.0);
}

static inline __attribute__((always_inline))
float easeInOut(thread float& x)
{
    x = fast::clamp(x, 0.0, 1.0);
    return (x * x) * (3.0 - (2.0 * x));
}

static inline __attribute__((always_inline))
float2 pathUnits(thread const float3& f, thread const float2& p, constant FlairUniforms& _160)
{
    return (float2(p.x, _160.iResolution[1u] - p.y) - f.xy) / float2(f.z);
}

static inline __attribute__((always_inline))
float4 pathNearest(texture2d<float> path, sampler pathSmplr, thread const float2& p, thread const float& from, thread const float& to, constant FlairUniforms& _160)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    float3 f = pathFrame(path, pathSmplr, _160);
    float3 param = f;
    float2 param_1 = p;
    float2 q = pathUnits(param, param_1, _160);
    float lo = from / f.z;
    float hi = to / f.z;
    int n = int(meta.x);
    int chunks = int(meta.z);
    float best = 100000002004087734272.0;
    float4 found = float4(100000002004087734272.0, 0.0, 1.0, 0.0);
    for (int c = 0; c < 64; c++)
    {
        if (c >= chunks)
        {
            break;
        }
        float4 bb = path.read(uint2(int2(3 + c, 1)), 0);
        float2 out_ = fast::max(fast::max(bb.xy - q, q - bb.zw), float2(0.0));
        if (dot(out_, out_) >= best)
        {
            continue;
        }
        int last = min(((c * 16) + 16), (n - 1));
        int _363 = c * 16;
        for (int i = _363; i < last; i++)
        {
            float4 a = path.read(uint2(int2(i, 0)), 0);
            float4 b = path.read(uint2(int2(i + 1, 0)), 0);
            bool _387 = b.w < 0.5;
            bool _395;
            if (!_387)
            {
                _395 = b.z < lo;
            }
            else
            {
                _395 = _387;
            }
            bool _403;
            if (!_395)
            {
                _403 = a.z > hi;
            }
            else
            {
                _403 = _395;
            }
            if (_403)
            {
                continue;
            }
            float span = fast::max(b.z - a.z, 9.999999717180685365747194737196e-10);
            float2 a2 = mix(a.xy, b.xy, float2(fast::clamp((lo - a.z) / span, 0.0, 1.0)));
            float2 b2 = mix(a.xy, b.xy, float2(fast::clamp((hi - a.z) / span, 0.0, 1.0)));
            float2 ab = b2 - a2;
            float2 aq = q - a2;
            float h = fast::clamp(dot(aq, ab) / fast::max(dot(ab, ab), 9.9999999600419720025001879548654e-13), 0.0, 1.0);
            float2 e = aq - (ab * h);
            float dd = dot(e, e);
            if (dd < best)
            {
                best = dd;
                found = float4(sqrt(dd) * f.z, mix(fast::max(a.z, lo), fast::min(b.z, hi), h) * f.z, (((ab.x * aq.y) - (ab.y * aq.x)) < 0.0) ? (-1.0) : 1.0, 1.0);
            }
        }
    }
    return found;
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _160)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _160);
    float s = fast::clamp(along / f.z, 0.0, meta.y);
    int lo = 0;
    int hi = n - 1;
    for (int k = 0; k < 11; k++)
    {
        if ((hi - lo) <= 1)
        {
            break;
        }
        int mid = (lo + hi) / 2;
        if (path.read(uint2(int2(mid, 0)), 0).z <= s)
        {
            lo = mid;
        }
        else
        {
            hi = mid;
        }
    }
    float4 a = path.read(uint2(int2(lo, 0)), 0);
    float4 b = path.read(uint2(int2(hi, 0)), 0);
    float2 _598;
    if (b.w < 0.5)
    {
        _598 = a.xy;
    }
    else
    {
        _598 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _598;
    float2 t = b.xy - a.xy;
    float2 _633;
    if (dot(t, t) > 0.0)
    {
        _633 = fast::normalize(t);
    }
    else
    {
        _633 = float2(1.0, 0.0);
    }
    t = _633;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _160.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 pathStroke(thread const float2& fc, thread const float& drop, thread const float& scale, thread const float& tail, thread const float& head, constant FlairUniforms& _160, texture2d<float> uPath, sampler uPathSmplr)
{
    float len = pathLength(uPath, uPathSmplr, _160);
    float2 q = fc + float2(0.0, (drop - _160.uY) * _160.iResolution[1u]);
    float2 param = q;
    float param_1 = tail * len;
    float param_2 = head * len;
    float4 n = pathNearest(uPath, uPathSmplr, param, param_1, param_2, _160);
    float u = n.y / len;
    float d = n.x / _160.iResolution[1u];
    float shown = n.w * step(0.001000000047497451305389404296875, head - tail);
    float hw = (((0.0005000000237487256526947021484375 * _160.uWidth) * scale) * powr(sin(3.141590118408203125 * u), 0.5)) * (0.449999988079071044921875 + (0.550000011920928955078125 * smoothstep(head, head - 0.20000000298023223876953125, u)));
    float px = 1.0 / _160.iResolution[1u];
    float core = (1.0 - smoothstep(hw, hw + (1.5 * px), d)) * shown;
    float halo = (exp((-d) / ((0.0030000000260770320892333984375 * _160.uWidth) * scale)) * shown) * _160.uGlow;
    if ((head > 0.0) && (head < 1.0))
    {
        float param_3 = head * len;
        float dh = length(q - pathAt(uPath, uPathSmplr, param_3, _160).xy) / _160.iResolution[1u];
        float lit = smoothstep(0.0, 0.0500000007450580596923828125, head);
        core = fast::max(core, (1.60000002384185791015625 * exp((-dh) / ((0.00120000005699694156646728515625 * _160.uWidth) * scale))) * lit);
        halo += ((exp((-dh) / ((0.004999999888241291046142578125 * _160.uWidth) * scale)) * _160.uGlow) * lit);
    }
    return float2(halo, core);
}

static inline __attribute__((always_inline))
float2 stroke(thread const float2& p, thread const float& drop, thread const float& scale, thread const float& tail, thread const float& head, constant FlairUniforms& _160)
{
    float W = (_160.uSpan * _160.iResolution[0u]) / _160.iResolution[1u];
    float uRaw = (p.x + (0.5 * W)) / W;
    float u = fast::clamp(uRaw, 0.0, 1.0);
    float y = ((_160.uY - drop) + (_160.uCurve * (((4.0 * (u - 0.5)) * (u - 0.5)) - 1.0))) + ((2.0 * _160.uRise) * (u - 0.5));
    float slope = (((8.0 * _160.uCurve) * (u - 0.5)) + (2.0 * _160.uRise)) / W;
    float dy = abs(p.y - y) / sqrt(1.0 + (slope * slope));
    float d = length(float2((uRaw - u) * W, dy));
    float shown = (smoothstep(tail, tail + 0.00999999977648258209228515625, u) * (1.0 - smoothstep(head - 0.0040000001899898052215576171875, head, u))) * step(0.001000000047497451305389404296875, head - tail);
    float hw = (((0.0005000000237487256526947021484375 * _160.uWidth) * scale) * powr(sin(3.141590118408203125 * u), 0.5)) * (0.449999988079071044921875 + (0.550000011920928955078125 * smoothstep(head, head - 0.20000000298023223876953125, u)));
    float px = 1.0 / _160.iResolution[1u];
    float core = (1.0 - smoothstep(hw, hw + (1.5 * px), d)) * shown;
    float halo = (exp((-d) / ((0.0030000000260770320892333984375 * _160.uWidth) * scale)) * shown) * _160.uGlow;
    if ((head > 0.0) && (head < 1.0))
    {
        float yh = ((_160.uY - drop) + (_160.uCurve * (((4.0 * (head - 0.5)) * (head - 0.5)) - 1.0))) + ((2.0 * _160.uRise) * (head - 0.5));
        float dh = length(p - float2((head * W) - (0.5 * W), yh));
        float lit = smoothstep(0.0, 0.0500000007450580596923828125, head);
        core = fast::max(core, (1.60000002384185791015625 * exp((-dh) / ((0.00120000005699694156646728515625 * _160.uWidth) * scale))) * lit);
        halo += ((exp((-dh) / ((0.004999999888241291046142578125 * _160.uWidth) * scale)) * _160.uGlow) * lit);
    }
    return float2(halo, core);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _160, texture2d<float> uPath, sampler uPathSmplr)
{
    float2 p = (fragCoord - (float2(_160.iResolution[0], _160.iResolution[1]) * 0.5)) / float2(_160.iResolution[1u]);
    bool onPath = pathLength(uPath, uPathSmplr, _160) > 0.0;
    float t = fract(_160.iTime / _160.uCycle);
    float _1108;
    if (_160.uAnimate != 0u)
    {
        float param = t / 0.4000000059604644775390625;
        _1108 = easeOut(param);
    }
    else
    {
        _1108 = 1.0;
    }
    float head = _1108;
    float _1122;
    if (_160.uAnimate != 0u)
    {
        float param_1 = (t - 0.60000002384185791015625) / 0.300000011920928955078125;
        float _1131 = easeInOut(param_1);
        _1122 = _1131;
    }
    else
    {
        _1122 = 0.0;
    }
    float tail = _1122;
    float2 _1136;
    if (onPath)
    {
        float2 param_2 = fragCoord;
        float param_3 = 0.0;
        float param_4 = 1.0;
        float param_5 = tail;
        float param_6 = head;
        _1136 = pathStroke(param_2, param_3, param_4, param_5, param_6, _160, uPath, uPathSmplr);
    }
    else
    {
        float2 param_7 = p;
        float param_8 = 0.0;
        float param_9 = 1.0;
        float param_10 = tail;
        float param_11 = head;
        _1136 = stroke(param_7, param_8, param_9, param_10, param_11, _160);
    }
    float2 s = _1136;
    if (_160.uSecond != 0u)
    {
        float _1169;
        if (_160.uAnimate != 0u)
        {
            float param_12 = (t - 0.0599999986588954925537109375) / 0.4000000059604644775390625;
            _1169 = 0.920000016689300537109375 * easeOut(param_12);
        }
        else
        {
            _1169 = 0.920000016689300537109375;
        }
        float head2 = _1169;
        float _1186;
        if (_160.uAnimate != 0u)
        {
            float param_13 = (t - 0.62000000476837158203125) / 0.300000011920928955078125;
            float _1195 = easeInOut(param_13);
            _1186 = fast::max(0.119999997317790985107421875, 0.920000016689300537109375 * _1195);
        }
        else
        {
            _1186 = 0.119999997317790985107421875;
        }
        float tail2 = _1186;
        float2 _1203;
        if (onPath)
        {
            float2 param_14 = fragCoord;
            float param_15 = 0.00260000000707805156707763671875 * _160.uWidth;
            float param_16 = 0.449999988079071044921875;
            float param_17 = tail2;
            float param_18 = head2;
            _1203 = pathStroke(param_14, param_15, param_16, param_17, param_18, _160, uPath, uPathSmplr);
        }
        else
        {
            float2 param_19 = p;
            float param_20 = 0.00260000000707805156707763671875 * _160.uWidth;
            float param_21 = 0.449999988079071044921875;
            float param_22 = tail2;
            float param_23 = head2;
            _1203 = stroke(param_19, param_20, param_21, param_22, param_23, _160);
        }
        s = fast::max(s, _1203 * 0.800000011920928955078125);
    }
    float4 acc = float4(float3(_160.uBackground) * _160.uBackgroundAlpha, _160.uBackgroundAlpha);
    float4 param_24 = acc;
    float3 param_25 = _160.uColor;
    float param_26 = fast::clamp(0.699999988079071044921875 * s.x, 0.0, 1.0);
    acc = over(param_24, param_25, param_26);
    float4 param_27 = acc;
    float3 param_28 = float3(_160.uCore);
    float param_29 = fast::clamp(s.y, 0.0, 1.0);
    acc = over(param_27, param_28, param_29);
    float4 param_30 = acc;
    fragColor = unpremultiply(param_30);
}

fragment flair_swoosh_underline_frag_out flair_swoosh_underline_frag(constant FlairUniforms& _160 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_swoosh_underline_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1288;
    if (_160.flair_flipY > 0.5)
    {
        _1288 = _160.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1288 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1288);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _160, uPath, uPathSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

