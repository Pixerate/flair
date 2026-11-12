// flair-metal-hash: f27e23f8
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
    packed_float3 uInk;
    float uWidth;
    float uPressure;
    float uBristles;
    float uDry;
    float uLife;
    uint uPaper;
    char _m20_pad[12];
    packed_float3 uPaperColor;
    uint uDemo;
};

struct flair_brush_trail_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool trailLive(thread const bool& demo, constant FlairUniforms& _262)
{
    bool _612 = !demo;
    bool _627;
    if (!_612)
    {
        bool _619 = _262.iTrail[0].w > 0.5;
        bool _626;
        if (_619)
        {
            _626 = _262.iPointer.z > 0.0;
        }
        else
        {
            _626 = _619;
        }
        _627 = _626;
    }
    else
    {
        _627 = _612;
    }
    return _627;
}

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _262)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_262.iResolution[0u], _262.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_262.iResolution[0], _262.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _294;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _294 = s.y;
    }
    else
    {
        float _303;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _303 = s.x;
        }
        else
        {
            float _313;
            if (meta.w < 1.5)
            {
                _313 = fast::min(s.x, s.y);
            }
            else
            {
                _313 = fast::max(s.x, s.y);
            }
            _303 = _313;
        }
        _294 = _303;
    }
    float k = _294;
    return float3((float2(_262.iResolution[0], _262.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _262)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _262).z;
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _262)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _262);
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
    float2 _437;
    if (b.w < 0.5)
    {
        _437 = a.xy;
    }
    else
    {
        _437 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _437;
    float2 t = b.xy - a.xy;
    float2 _473;
    if (dot(t, t) > 0.0)
    {
        _473 = fast::normalize(t);
    }
    else
    {
        _473 = float2(1.0, 0.0);
    }
    t = _473;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _262.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 demoPath(thread const float& t, constant FlairUniforms& _262, texture2d<float> uPath, sampler uPathSmplr)
{
    float s = t * 1.2999999523162841796875;
    float len = pathLength(uPath, uPathSmplr, _262);
    if (len > 0.0)
    {
        float lap = s / 6.283185482025146484375;
        float param = 0.0;
        float param_1 = len;
        bool closed = length(pathAt(uPath, uPathSmplr, param, _262).xy - pathAt(uPath, uPathSmplr, param_1, _262).xy) < 2.0;
        float _530;
        if (closed)
        {
            _530 = fract(lap) * len;
        }
        else
        {
            _530 = (0.5 - (0.5 * cos(3.1415927410125732421875 * lap))) * len;
        }
        float param_2 = _530;
        return pathAt(uPath, uPathSmplr, param_2, _262).xy;
    }
    float2 q = float2((0.3400000035762786865234375 * sin(s)) + (0.0500000007450580596923828125 * sin((s * 2.2999999523162841796875) + 1.0)), (0.2700000107288360595703125 * sin((s * 2.0) + 0.4000000059604644775390625)) + (0.039999999105930328369140625 * cos(s * 3.099999904632568359375)));
    return float2(_262.iResolution[0], _262.iResolution[1]) * (float2(0.5) + q);
}

static inline __attribute__((always_inline))
float4 trailAt(thread const int& i, thread const bool& live, constant FlairUniforms& _262, texture2d<float> uPath, sampler uPathSmplr)
{
    if (live)
    {
        return _262.iTrail[i];
    }
    float _641;
    if (i == 0)
    {
        _641 = _262.iTime;
    }
    else
    {
        _641 = ((floor(_262.iTime / 0.033330000936985015869140625) + 1.0) - float(i)) * 0.033330000936985015869140625;
    }
    float t = _641;
    float param = t;
    return float4(demoPath(param, _262, uPath, uPathSmplr), t, 1.0);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
void trailFrom(thread const int& i, thread const bool& live, constant FlairUniforms& _262, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    gWalkI = i;
    if (live)
    {
        return;
    }
    gWalkBase = floor(_262.iTime / 0.033330000936985015869140625) + 1.0;
    gWalkPath = pathLength(uPath, uPathSmplr, _262) > 0.0;
    float s = ((gWalkBase - float(i)) * 0.033330000936985015869140625) * 1.2999999523162841796875;
    float4 phase = float4(s, (s * 2.2999999523162841796875) + 1.0, (s * 2.0) + 0.4000000059604644775390625, s * 3.099999904632568359375);
    gWalkCos = cos(phase);
    gWalkSin = sin(phase);
}

static inline __attribute__((always_inline))
bool trailJump(thread const float4& a, thread const float4& b, constant FlairUniforms& _262)
{
    bool _594 = (a.z - b.z) > 0.25;
    bool _608;
    if (_594)
    {
        _608 = length(a.xy - b.xy) > (0.02999999932944774627685546875 * _262.iResolution[1u]);
    }
    else
    {
        _608 = _594;
    }
    return _608;
}

static inline __attribute__((always_inline))
float4 trailNext(thread const bool& live, constant FlairUniforms& _262, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    int i = gWalkI;
    gWalkI++;
    if (live)
    {
        return _262.iTrail[min(i, 31)];
    }
    if (gWalkPath)
    {
        float param = (gWalkBase - float(i)) * 0.033330000936985015869140625;
        return float4(demoPath(param, _262, uPath, uPathSmplr), (gWalkBase - float(i)) * 0.033330000936985015869140625, 1.0);
    }
    float2 q = float2((0.3400000035762786865234375 * gWalkSin.x) + (0.0500000007450580596923828125 * gWalkSin.y), (0.2700000107288360595703125 * gWalkSin.z) + (0.039999999105930328369140625 * gWalkCos.w));
    float4 point = float4(float2(_262.iResolution[0], _262.iResolution[1]) * (float2(0.5) + q), (gWalkBase - float(i)) * 0.033330000936985015869140625, 1.0);
    float4 c = (gWalkCos * float4(0.999061286449432373046875, 0.995037376880645751953125, 0.996246814727783203125, 0.990990817546844482421875)) + (gWalkSin * float4(0.043319769203662872314453125, 0.099501736462116241455078125, 0.08655820786952972412109375, 0.13392968475818634033203125));
    gWalkSin = (gWalkSin * float4(0.999061286449432373046875, 0.995037376880645751953125, 0.996246814727783203125, 0.990990817546844482421875)) - (gWalkCos * float4(0.043319769203662872314453125, 0.099501736462116241455078125, 0.08655820786952972412109375, 0.13392968475818634033203125));
    gWalkCos = c;
    return point;
}

static inline __attribute__((always_inline))
float pressWidth(thread const float4& a, thread const float4& b, thread const float& px, constant FlairUniforms& _262)
{
    float speed = (length(b.xy - a.xy) * px) / fast::max(abs(a.z - b.z), 0.0041666668839752674102783203125);
    return _262.uWidth * mix(0.300000011920928955078125, 1.0, 1.0 / (1.0 + ((speed * _262.uPressure) * 1.5)));
}

static inline __attribute__((always_inline))
float2 segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 1.0000000133514319600180897396058e-10), 0.0, 1.0);
    return float2(length((p - a) - (ab * t)), t);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _262, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    float px = 1.0 / _262.iResolution[1u];
    float2 p = fragCoord * px;
    bool param = _262.uDemo != 0u;
    bool live = trailLive(param, _262);
    int param_1 = 0;
    bool param_2 = live;
    float4 a = trailAt(param_1, param_2, _262, uPath, uPathSmplr);
    int param_3 = 1;
    bool param_4 = live;
    float4 b = trailAt(param_3, param_4, _262, uPath, uPathSmplr);
    float best = 1000000000.0;
    float bestU = 1.0;
    float bestV = 0.0;
    float bestFade = 0.0;
    float2 param_5 = p * 180.0;
    float rag = 0.89999997615814208984375 + (0.20000000298023223876953125 * vnoise(param_5));
    bool _905 = a.w > 0.5;
    bool _911;
    if (_905)
    {
        _911 = b.w > 0.5;
    }
    else
    {
        _911 = _905;
    }
    if (_911)
    {
        float reach = 1.10000002384185791015625 * _262.uWidth;
        int param_6 = 2;
        bool param_7 = live;
        trailFrom(param_6, param_7, _262, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
        float4 _951;
        float _1021;
        for (int k = 0; k < 31; k++)
        {
            bool _933 = b.w < 0.5;
            bool _942;
            if (!_933)
            {
                float4 param_8 = a;
                float4 param_9 = b;
                _942 = trailJump(param_8, param_9, _262);
            }
            else
            {
                _942 = _933;
            }
            if (_942)
            {
                break;
            }
            if ((k + 2) < 32)
            {
                bool param_10 = live;
                float4 _956 = trailNext(param_10, _262, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
                _951 = _956;
            }
            else
            {
                _951 = float4(0.0);
            }
            float4 next = _951;
            float2 off = fast::max(fast::max((fast::min(a.xy, b.xy) * px) - p, p - (fast::max(a.xy, b.xy) * px)), float2(0.0));
            float r = best + reach;
            bool _987 = r > 0.0;
            bool _997;
            if (_987)
            {
                _997 = dot(off, off) < (r * r);
            }
            else
            {
                _997 = _987;
            }
            if (_997)
            {
                float4 param_11 = a;
                float4 param_12 = b;
                float param_13 = px;
                float wa = pressWidth(param_11, param_12, param_13, _262);
                bool _1011 = next.w > 0.5;
                bool _1020;
                if (_1011)
                {
                    float4 param_14 = b;
                    float4 param_15 = next;
                    _1020 = !trailJump(param_14, param_15, _262);
                }
                else
                {
                    _1020 = _1011;
                }
                if (_1020)
                {
                    float4 param_16 = b;
                    float4 param_17 = next;
                    float param_18 = px;
                    _1021 = pressWidth(param_16, param_17, param_18, _262);
                }
                else
                {
                    _1021 = wa;
                }
                float wb = _1021;
                float2 param_19 = p;
                float2 param_20 = a.xy * px;
                float2 param_21 = b.xy * px;
                float2 s = segment(param_19, param_20, param_21);
                float u = (float(k) + s.y) / 31.0;
                float fade = fast::clamp(1.0 - ((_262.iTime - mix(a.z, b.z, s.y)) / _262.uLife), 0.0, 1.0);
                float w = (mix(wa, wb, s.y) * (1.0 - (0.60000002384185791015625 * smoothstep(0.550000011920928955078125, 1.0, u)))) * smoothstep(0.0, 0.039999999105930328369140625, u + 0.00999999977648258209228515625);
                w *= (0.4000000059604644775390625 + (0.60000002384185791015625 * fade));
                float sd = s.x - (w * rag);
                if (sd < best)
                {
                    float2 dir = b.xy - a.xy;
                    float side = (dir.x * (p.y - (a.y * px))) - (dir.y * (p.x - (a.x * px)));
                    best = sd;
                    bestU = u;
                    bestV = fast::clamp(s.x / fast::max(w, 9.9999997473787516355514526367188e-06), 0.0, 1.0) * ((side < 0.0) ? (-1.0) : 1.0);
                    bestFade = fade;
                }
            }
            a = b;
            b = next;
        }
    }
    float cover = (1.0 - smoothstep(-px, px, best)) * smoothstep(0.0, 0.100000001490116119384765625, bestFade);
    float3 col = float3(_262.uInk);
    if (cover > 0.0)
    {
        float2 param_22 = float2(bestV * _262.uBristles, 3.7000000476837158203125);
        float2 param_23 = p * float2(55.0);
        int param_24 = 3;
        float _1191 = fbm(param_23, param_24);
        float bristle = (0.60000002384185791015625 * vnoise(param_22)) + (0.4000000059604644775390625 * _1191);
        float dry = ((_262.uDry * smoothstep(0.1500000059604644775390625, 1.0, bestU)) + ((0.3499999940395355224609375 * _262.uDry) * smoothstep(0.60000002384185791015625, 1.0, abs(bestV)))) + (0.699999988079071044921875 * (1.0 - bestFade));
        cover *= smoothstep(dry - 0.0599999986588954925537109375, dry + 0.0599999986588954925537109375, bristle * 1.10000002384185791015625);
        col = (float3(_262.uInk) * (1.0 + ((0.60000002384185791015625 * (1.0 - bristle)) * (1.0 - abs(bestV))))) + float3(0.039999999105930328369140625 * (1.0 - bristle));
    }
    if (_262.uPaper != 0u)
    {
        float2 param_25 = p * 9.0;
        int param_26 = 4;
        float _1260 = fbm(param_25, param_26);
        float2 param_27 = p * float2(400.0, 30.0);
        float3 paper = (float3(_262.uPaperColor) * (0.949999988079071044921875 + (0.070000000298023223876953125 * _1260))) - float3(0.02999999932944774627685546875 * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, vnoise(param_27)));
        fragColor = float4(mix(paper, col, float3(cover * 0.949999988079071044921875)), 1.0);
    }
    else
    {
        fragColor = float4(col, cover);
    }
}

fragment flair_brush_trail_frag_out flair_brush_trail_frag(constant FlairUniforms& _262 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_brush_trail_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    int gWalkI;
    float gWalkBase;
    bool gWalkPath;
    float4 gWalkCos;
    float4 gWalkSin;
    float _1304;
    if (_262.flair_flipY > 0.5)
    {
        _1304 = _262.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1304 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1304);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _262, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

