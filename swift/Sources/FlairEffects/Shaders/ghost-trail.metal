// flair-metal-hash: 0849366d
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
    float uUnit;
};

struct flair_ghost_trail_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float trailUnit(constant FlairUniforms& _103)
{
    float _352;
    if (_103.uUnit > 0.0)
    {
        _352 = _103.uUnit;
    }
    else
    {
        _352 = _103.iResolution[1u];
    }
    return _352;
}

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _103)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_103.iResolution[0u], _103.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_103.iResolution[0], _103.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _137;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _137 = s.y;
    }
    else
    {
        float _146;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _146 = s.x;
        }
        else
        {
            float _156;
            if (meta.w < 1.5)
            {
                _156 = fast::min(s.x, s.y);
            }
            else
            {
                _156 = fast::max(s.x, s.y);
            }
            _146 = _156;
        }
        _137 = _146;
    }
    float k = _137;
    return float3((float2(_103.iResolution[0], _103.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _103)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _103).z;
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _103)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _103);
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
    float2 _281;
    if (b.w < 0.5)
    {
        _281 = a.xy;
    }
    else
    {
        _281 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _281;
    float2 t = b.xy - a.xy;
    float2 _317;
    if (dot(t, t) > 0.0)
    {
        _317 = fast::normalize(t);
    }
    else
    {
        _317 = float2(1.0, 0.0);
    }
    t = _317;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _103.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 demoPath(thread const float& t, constant FlairUniforms& _103, texture2d<float> uPath, sampler uPathSmplr)
{
    float s = t * 1.39999997615814208984375;
    float len = pathLength(uPath, uPathSmplr, _103);
    if (len > 0.0)
    {
        float lap = s / 6.283185482025146484375;
        float param = 0.0;
        float param_1 = len;
        bool closed = length(pathAt(uPath, uPathSmplr, param, _103).xy - pathAt(uPath, uPathSmplr, param_1, _103).xy) < 2.0;
        float _390;
        if (closed)
        {
            _390 = fract(lap) * len;
        }
        else
        {
            _390 = (0.5 - (0.5 * cos(3.1415927410125732421875 * lap))) * len;
        }
        float param_2 = _390;
        return pathAt(uPath, uPathSmplr, param_2, _103).xy;
    }
    float2 q = float2((0.3400000035762786865234375 * sin(s)) + (0.0500000007450580596923828125 * sin((s * 2.2999999523162841796875) + 1.0)), (0.2700000107288360595703125 * sin((s * 2.0) + 0.4000000059604644775390625)) + (0.039999999105930328369140625 * cos(s * 3.099999904632568359375)));
    return float2(_103.iResolution[0], _103.iResolution[1]) * (float2(0.5) + q);
}

static inline __attribute__((always_inline))
float4 trailPoint(thread const int& i, thread const bool& demo, constant FlairUniforms& _103, texture2d<float> uPath, sampler uPathSmplr)
{
    bool _449 = !demo;
    bool _464;
    if (!_449)
    {
        bool _456 = _103.iTrail[0].w > 0.5;
        bool _463;
        if (_456)
        {
            _463 = _103.iPointer.z > 0.0;
        }
        else
        {
            _463 = _456;
        }
        _464 = _463;
    }
    else
    {
        _464 = _449;
    }
    if (_464)
    {
        return _103.iTrail[i];
    }
    float _475;
    if (i == 0)
    {
        _475 = _103.iTime;
    }
    else
    {
        _475 = ((floor(_103.iTime / 0.0199999995529651641845703125) + 1.0) - float(i)) * 0.0199999995529651641845703125;
    }
    float t = _475;
    float param = t;
    return float4(demoPath(param, _103, uPath, uPathSmplr), t, 1.0);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _103, texture2d<float> uPath, sampler uPathSmplr)
{
    float px = 1.0 / trailUnit(_103);
    float2 p = fragCoord * px;
    float4 acc = float4(0.0);
    float2 last = float2(-100000.0);
    float _691;
    float sd;
    for (int k = 0; k < 32; k++)
    {
        int param = k;
        bool param_1 = _103.uDemo != 0u;
        float4 q = trailPoint(param, param_1, _103, uPath, uPathSmplr);
        if (q.w < 0.5)
        {
            break;
        }
        float2 c = q.xy * px;
        bool _637 = k > 0;
        bool _648;
        if (_637)
        {
            _648 = length(c - last) < _103.uSpacing;
        }
        else
        {
            _648 = _637;
        }
        if (_648)
        {
            continue;
        }
        last = c;
        float u = float(k) / 31.0;
        float fade = powr(1.0 - u, _103.uDecay) * fast::clamp(1.0 - ((_103.iTime - q.z) / _103.uLife), 0.0, 1.0);
        if (fade < 0.0030000000260770320892333984375)
        {
            continue;
        }
        if (_103.uShrink != 0u)
        {
            _691 = mix(1.0, 0.4000000059604644775390625, u);
        }
        else
        {
            _691 = 1.0;
        }
        float r = _103.uSize * _691;
        float2 d = p - c;
        if (dot(d, d) > (((r * r) * 2.599999904632568359375) + ((4.0 * px) * px)))
        {
            continue;
        }
        float shade = 1.0;
        if (_103.uShape == 1)
        {
            sd = abs(length(d) - (r * 0.819999992847442626953125)) - (r * 0.1599999964237213134765625);
        }
        else
        {
            if (_103.uShape == 2)
            {
                float an = (float(k) * 0.25) + (_103.iTime * 0.800000011920928955078125);
                d = float2x2(float2(cos(an), sin(an)), float2(-sin(an), cos(an))) * d;
                float2 param_2 = d;
                float param_3 = r;
                float param_4 = 0.449999988079071044921875;
                float _778 = star5(param_2, param_3, param_4);
                sd = _778;
            }
            else
            {
                sd = length(d) - r;
                shade = 0.699999988079071044921875 + (0.300000011920928955078125 * (1.0 - (length(d) / r)));
            }
        }
        float al = ((1.0 - smoothstep(-px, px, sd)) * fade) * _103.uOpacity;
        float3 param_5 = float3(_103.uColor);
        float param_6 = (u * _103.uHueShift) * 6.28318023681640625;
        float3 col = hueShift(param_5, param_6) * shade;
        if (k == 0)
        {
            col = mix(col, float3(1.0), float3(0.5 * smoothstep((-3.0) * px, 0.0, sd)));
        }
        float _837 = acc.w;
        float4 _843 = acc;
        float3 _845 = _843.xyz + ((col * (1.0 - _837)) * al);
        acc.x = _845.x;
        acc.y = _845.y;
        acc.z = _845.z;
        acc.w += ((1.0 - acc.w) * al);
    }
    fragColor = float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

fragment flair_ghost_trail_frag_out flair_ghost_trail_frag(constant FlairUniforms& _103 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_ghost_trail_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _889;
    if (_103.flair_flipY > 0.5)
    {
        _889 = _103.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _889 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _889);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _103, uPath, uPathSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

