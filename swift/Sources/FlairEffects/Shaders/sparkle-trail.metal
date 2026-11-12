// flair-metal-hash: 9dbb8421
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
    float3 uColorA;
    packed_float3 uColorB;
    int uCount;
    float uSize;
    float uSpread;
    float uFall;
    float uLife;
    float uTwinkle;
    float uIntensity;
    uint uDemo;
};

struct flair_sparkle_trail_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool trailLive(thread const bool& demo, constant FlairUniforms& _166)
{
    bool _495 = !demo;
    bool _510;
    if (!_495)
    {
        bool _502 = _166.iTrail[0].w > 0.5;
        bool _509;
        if (_502)
        {
            _509 = _166.iPointer.z > 0.0;
        }
        else
        {
            _509 = _502;
        }
        _510 = _509;
    }
    else
    {
        _510 = _495;
    }
    return _510;
}

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _166)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_166.iResolution[0u], _166.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_166.iResolution[0], _166.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _199;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _199 = s.y;
    }
    else
    {
        float _208;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _208 = s.x;
        }
        else
        {
            float _218;
            if (meta.w < 1.5)
            {
                _218 = fast::min(s.x, s.y);
            }
            else
            {
                _218 = fast::max(s.x, s.y);
            }
            _208 = _218;
        }
        _199 = _208;
    }
    float k = _199;
    return float3((float2(_166.iResolution[0], _166.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _166)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _166).z;
}

static inline __attribute__((always_inline))
void trailFrom(thread const int& i, thread const bool& live, constant FlairUniforms& _166, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    gWalkI = i;
    if (live)
    {
        return;
    }
    gWalkBase = floor(_166.iTime / 0.02500000037252902984619140625) + 1.0;
    gWalkPath = pathLength(uPath, uPathSmplr, _166) > 0.0;
    float s = ((gWalkBase - float(i)) * 0.02500000037252902984619140625) * 1.39999997615814208984375;
    float4 phase = float4(s, (s * 2.2999999523162841796875) + 1.0, (s * 2.0) + 0.4000000059604644775390625, s * 3.099999904632568359375);
    gWalkCos = cos(phase);
    gWalkSin = sin(phase);
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _166)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _166);
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
    float2 _342;
    if (b.w < 0.5)
    {
        _342 = a.xy;
    }
    else
    {
        _342 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _342;
    float2 t = b.xy - a.xy;
    float2 _378;
    if (dot(t, t) > 0.0)
    {
        _378 = fast::normalize(t);
    }
    else
    {
        _378 = float2(1.0, 0.0);
    }
    t = _378;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _166.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 demoPath(thread const float& t, constant FlairUniforms& _166, texture2d<float> uPath, sampler uPathSmplr)
{
    float s = t * 1.39999997615814208984375;
    float len = pathLength(uPath, uPathSmplr, _166);
    if (len > 0.0)
    {
        float lap = s / 6.283185482025146484375;
        float param = 0.0;
        float param_1 = len;
        bool closed = length(pathAt(uPath, uPathSmplr, param, _166).xy - pathAt(uPath, uPathSmplr, param_1, _166).xy) < 2.0;
        float _436;
        if (closed)
        {
            _436 = fract(lap) * len;
        }
        else
        {
            _436 = (0.5 - (0.5 * cos(3.1415927410125732421875 * lap))) * len;
        }
        float param_2 = _436;
        return pathAt(uPath, uPathSmplr, param_2, _166).xy;
    }
    float2 q = float2((0.3400000035762786865234375 * sin(s)) + (0.0500000007450580596923828125 * sin((s * 2.2999999523162841796875) + 1.0)), (0.2700000107288360595703125 * sin((s * 2.0) + 0.4000000059604644775390625)) + (0.039999999105930328369140625 * cos(s * 3.099999904632568359375)));
    return float2(_166.iResolution[0], _166.iResolution[1]) * (float2(0.5) + q);
}

static inline __attribute__((always_inline))
float4 trailNext(thread const bool& live, constant FlairUniforms& _166, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    int i = gWalkI;
    gWalkI++;
    if (live)
    {
        return _166.iTrail[min(i, 31)];
    }
    if (gWalkPath)
    {
        float param = (gWalkBase - float(i)) * 0.02500000037252902984619140625;
        return float4(demoPath(param, _166, uPath, uPathSmplr), (gWalkBase - float(i)) * 0.02500000037252902984619140625, 1.0);
    }
    float2 q = float2((0.3400000035762786865234375 * gWalkSin.x) + (0.0500000007450580596923828125 * gWalkSin.y), (0.2700000107288360595703125 * gWalkSin.z) + (0.039999999105930328369140625 * gWalkCos.w));
    float4 point = float4(float2(_166.iResolution[0], _166.iResolution[1]) * (float2(0.5) + q), (gWalkBase - float(i)) * 0.02500000037252902984619140625, 1.0);
    float4 c = (gWalkCos * float4(0.999387562274932861328125, 0.996761620044708251953125, 0.997551023960113525390625, 0.9941196441650390625)) + (gWalkSin * float4(0.034992851316928863525390625, 0.080413080751895904541015625, 0.06994284689426422119140625, 0.108287237584590911865234375));
    gWalkSin = (gWalkSin * float4(0.999387562274932861328125, 0.996761620044708251953125, 0.997551023960113525390625, 0.9941196441650390625)) - (gWalkCos * float4(0.034992851316928863525390625, 0.080413080751895904541015625, 0.06994284689426422119140625, 0.108287237584590911865234375));
    gWalkCos = c;
    return point;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _166, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    float px = 1.0 / _166.iResolution[1u];
    float2 p = fragCoord * px;
    float3 col = float3(0.0);
    bool param = _166.uDemo != 0u;
    bool live = trailLive(param, _166);
    float reach = (2.5 * _166.uSize) + px;
    float side = (_166.uSpread + 0.01200000010430812835693359375) + reach;
    int param_1 = 1;
    bool param_2 = live;
    trailFrom(param_1, param_2, _166, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    float3 _1028;
    for (int k = 1; k < 32; k++)
    {
        bool param_3 = live;
        float4 _726 = trailNext(param_3, _166, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
        float4 q = _726;
        if (q.w < 0.5)
        {
            break;
        }
        float age = _166.iTime - q.z;
        bool _740 = age < 0.0;
        bool _749;
        if (!_740)
        {
            _749 = age > _166.uLife;
        }
        else
        {
            _749 = _740;
        }
        if (_749)
        {
            continue;
        }
        float2 rel = p - (q.xy * px);
        float fall = (_166.uFall * age) * (0.4000000059604644775390625 + (0.60000002384185791015625 * age));
        bool _775 = abs(rel.x) > side;
        bool _786;
        if (!_775)
        {
            _786 = rel.y > (_166.uSpread + reach);
        }
        else
        {
            _786 = _775;
        }
        bool _800;
        if (!_786)
        {
            _800 = rel.y < (((-_166.uSpread) - fall) - reach);
        }
        else
        {
            _800 = _786;
        }
        if (_800)
        {
            continue;
        }
        float life = age / _166.uLife;
        float keep = 1.0 - smoothstep(26.0, 31.0, float(k));
        float env = ((smoothstep(0.0, 0.07999999821186065673828125, life) * (1.0 - life)) * (1.0 - life)) * keep;
        for (int j = 0; j < 4; j++)
        {
            if (j >= _166.uCount)
            {
                break;
            }
            float2 param_4 = float2((q.z * 61.369998931884765625) + (float(j) * 7.13000011444091796875), float(j) + 0.5);
            float2 h = hash22(param_4);
            float2 param_5 = (h * 37.09999847412109375) + float2(q.z);
            float h3 = hash12(param_5);
            float2 pos = (q.xy * px) + (((h - float2(0.5)) * 2.0) * _166.uSpread);
            pos += float2(0.01200000010430812835693359375 * sin((age * 3.0) + (h.x * 6.28318023681640625)), ((-_166.uFall) * age) * (0.4000000059604644775390625 + (0.60000002384185791015625 * age)));
            float s = _166.uSize * (0.449999988079071044921875 + (0.800000011920928955078125 * h3));
            float2 d = pos - p;
            if (dot(d, d) > ((s * s) * 4.0))
            {
                continue;
            }
            float an = (h.y - 0.5) * 0.89999997615814208984375;
            d = float2x2(float2(cos(an), sin(an)), float2(-sin(an), cos(an))) * d;
            float tw = mix(1.0, 0.3499999940395355224609375 + (0.64999997615814208984375 * (0.5 + (0.5 * sin((age * (12.0 + (12.0 * h.y))) + (h.x * 6.28318023681640625))))), _166.uTwinkle);
            float rays = exp((-abs(d.x)) / (s * 0.0500000007450580596923828125)) * exp((-abs(d.y)) / (s * 0.449999988079071044921875));
            rays += (exp((-abs(d.y)) / (s * 0.0500000007450580596923828125)) * exp((-abs(d.x)) / (s * 0.449999988079071044921875)));
            float core = exp((-dot(d, d)) / ((s * s) * 0.0199999995529651641845703125));
            if (h3 < 0.5)
            {
                _1028 = _166.uColorA;
            }
            else
            {
                _1028 = float3(_166.uColorB);
            }
            float3 tint = _1028;
            col += ((((tint * ((rays * 0.89999997615814208984375) + (core * 0.60000002384185791015625))) + (float3(1.0) * core)) * env) * tw);
        }
    }
    float3 param_6 = col * _166.uIntensity;
    float4 _1066 = glow(param_6);
    fragColor = _1066;
}

fragment flair_sparkle_trail_frag_out flair_sparkle_trail_frag(constant FlairUniforms& _166 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_sparkle_trail_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    int gWalkI;
    float gWalkBase;
    bool gWalkPath;
    float4 gWalkCos;
    float4 gWalkSin;
    float _1079;
    if (_166.flair_flipY > 0.5)
    {
        _1079 = _166.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1079 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1079);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _166, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

