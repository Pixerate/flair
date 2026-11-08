// flair-metal-hash: ede82f0f
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
    int uShape;
    char _m14_pad[12];
    packed_float3 uColor;
    float uSize;
    float uSpacing;
    float uOpacity;
    float uDecay;
    float uHueShift;
    float uLife;
    uint uShrink;
    uint uDemo;
};

struct flair_ghost_trail_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _100)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_100.iResolution[0u], _100.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_100.iResolution[0], _100.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _134;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _134 = s.y;
    }
    else
    {
        float _143;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _143 = s.x;
        }
        else
        {
            float _153;
            if (meta.w < 1.5)
            {
                _153 = fast::min(s.x, s.y);
            }
            else
            {
                _153 = fast::max(s.x, s.y);
            }
            _143 = _153;
        }
        _134 = _143;
    }
    float k = _134;
    return float3((float2(_100.iResolution[0], _100.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _100)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _100).z;
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _100)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _100);
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
    float2 _278;
    if (b.w < 0.5)
    {
        _278 = a.xy;
    }
    else
    {
        _278 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _278;
    float2 t = b.xy - a.xy;
    float2 _314;
    if (dot(t, t) > 0.0)
    {
        _314 = fast::normalize(t);
    }
    else
    {
        _314 = float2(1.0, 0.0);
    }
    t = _314;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _100.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 demoPath(thread const float& t, constant FlairUniforms& _100, texture2d<float> uPath, sampler uPathSmplr)
{
    float s = t * 1.39999997615814208984375;
    float len = pathLength(uPath, uPathSmplr, _100);
    if (len > 0.0)
    {
        float lap = s / 6.283185482025146484375;
        float param = 0.0;
        float param_1 = len;
        bool closed = length(pathAt(uPath, uPathSmplr, param, _100).xy - pathAt(uPath, uPathSmplr, param_1, _100).xy) < 2.0;
        float _372;
        if (closed)
        {
            _372 = fract(lap) * len;
        }
        else
        {
            _372 = (0.5 - (0.5 * cos(3.1415927410125732421875 * lap))) * len;
        }
        float param_2 = _372;
        return pathAt(uPath, uPathSmplr, param_2, _100).xy;
    }
    float2 q = float2((0.3400000035762786865234375 * sin(s)) + (0.0500000007450580596923828125 * sin((s * 2.2999999523162841796875) + 1.0)), (0.2700000107288360595703125 * sin((s * 2.0) + 0.4000000059604644775390625)) + (0.039999999105930328369140625 * cos(s * 3.099999904632568359375)));
    return float2(_100.iResolution[0], _100.iResolution[1]) * (float2(0.5) + q);
}

static inline __attribute__((always_inline))
float4 trailPoint(thread const int& i, thread const bool& demo, constant FlairUniforms& _100, texture2d<float> uPath, sampler uPathSmplr)
{
    bool _431 = !demo;
    bool _446;
    if (!_431)
    {
        bool _438 = _100.iTrail[0].w > 0.5;
        bool _445;
        if (_438)
        {
            _445 = _100.iPointer.z > 0.0;
        }
        else
        {
            _445 = _438;
        }
        _446 = _445;
    }
    else
    {
        _446 = _431;
    }
    if (_446)
    {
        return _100.iTrail[i];
    }
    float _457;
    if (i == 0)
    {
        _457 = _100.iTime;
    }
    else
    {
        _457 = ((floor(_100.iTime / 0.0199999995529651641845703125) + 1.0) - float(i)) * 0.0199999995529651641845703125;
    }
    float t = _457;
    float param = t;
    return float4(demoPath(param, _100, uPath, uPathSmplr), t, 1.0);
}

static inline __attribute__((always_inline))
float star5(thread float2& p, thread const float& r, thread const float& rf)
{
    p.x = abs(p.x);
    p -= (float2(0.809017002582550048828125, -0.587785243988037109375) * (2.0 * fast::max(dot(float2(0.809017002582550048828125, -0.587785243988037109375), p), 0.0)));
    p -= (float2(-0.809017002582550048828125, -0.587785243988037109375) * (2.0 * fast::max(dot(float2(-0.809017002582550048828125, -0.587785243988037109375), p), 0.0)));
    p.x = abs(p.x);
    p.y -= r;
    float2 ba = (float2(0.587785243988037109375, 0.809017002582550048828125) * rf) - float2(0.0, 1.0);
    float h = fast::clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
    return length(p - (ba * h)) * sign((p.y * ba.x) - (p.x * ba.y));
}

static inline __attribute__((always_inline))
float3 hueShift(thread const float3& c, thread const float& a)
{
    float ca = cos(a);
    return ((c * ca) + (cross(float3(0.57735002040863037109375), c) * sin(a))) + ((float3(0.57735002040863037109375) * dot(float3(0.57735002040863037109375), c)) * (1.0 - ca));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _100, texture2d<float> uPath, sampler uPathSmplr)
{
    float px = 1.0 / _100.iResolution[1u];
    float2 p = fragCoord * px;
    float4 acc = float4(0.0);
    float2 last = float2(-100000.0);
    float _674;
    float sd;
    for (int k = 0; k < 32; k++)
    {
        int param = k;
        bool param_1 = _100.uDemo != 0u;
        float4 q = trailPoint(param, param_1, _100, uPath, uPathSmplr);
        if (q.w < 0.5)
        {
            break;
        }
        float2 c = q.xy * px;
        bool _620 = k > 0;
        bool _631;
        if (_620)
        {
            _631 = length(c - last) < _100.uSpacing;
        }
        else
        {
            _631 = _620;
        }
        if (_631)
        {
            continue;
        }
        last = c;
        float u = float(k) / 31.0;
        float fade = powr(1.0 - u, _100.uDecay) * fast::clamp(1.0 - ((_100.iTime - q.z) / _100.uLife), 0.0, 1.0);
        if (fade < 0.0030000000260770320892333984375)
        {
            continue;
        }
        if (_100.uShrink != 0u)
        {
            _674 = mix(1.0, 0.4000000059604644775390625, u);
        }
        else
        {
            _674 = 1.0;
        }
        float r = _100.uSize * _674;
        float2 d = p - c;
        if (dot(d, d) > (((r * r) * 2.599999904632568359375) + ((4.0 * px) * px)))
        {
            continue;
        }
        float shade = 1.0;
        if (_100.uShape == 1)
        {
            sd = abs(length(d) - (r * 0.819999992847442626953125)) - (r * 0.1599999964237213134765625);
        }
        else
        {
            if (_100.uShape == 2)
            {
                float an = (float(k) * 0.25) + (_100.iTime * 0.800000011920928955078125);
                d = float2x2(float2(cos(an), sin(an)), float2(-sin(an), cos(an))) * d;
                float2 param_2 = d;
                float param_3 = r;
                float param_4 = 0.449999988079071044921875;
                float _761 = star5(param_2, param_3, param_4);
                sd = _761;
            }
            else
            {
                sd = length(d) - r;
                shade = 0.699999988079071044921875 + (0.300000011920928955078125 * (1.0 - (length(d) / r)));
            }
        }
        float al = ((1.0 - smoothstep(-px, px, sd)) * fade) * _100.uOpacity;
        float3 param_5 = float3(_100.uColor);
        float param_6 = (u * _100.uHueShift) * 6.28318023681640625;
        float3 col = hueShift(param_5, param_6) * shade;
        if (k == 0)
        {
            col = mix(col, float3(1.0), float3(0.5 * smoothstep((-3.0) * px, 0.0, sd)));
        }
        float _820 = acc.w;
        float4 _826 = acc;
        float3 _828 = _826.xyz + ((col * (1.0 - _820)) * al);
        acc.x = _828.x;
        acc.y = _828.y;
        acc.z = _828.z;
        acc.w += ((1.0 - acc.w) * al);
    }
    fragColor = float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

fragment flair_ghost_trail_frag_out flair_ghost_trail_frag(constant FlairUniforms& _100 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_ghost_trail_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _872;
    if (_100.flair_flipY > 0.5)
    {
        _872 = _100.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _872 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _872);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _100, uPath, uPathSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

