// flair-metal-hash: 22c960b1
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
    float uUnit;
};

struct flair_brush_trail_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float trailUnit(constant FlairUniforms& _265)
{
    float _510;
    if (_265.uUnit > 0.0)
    {
        _510 = _265.uUnit;
    }
    else
    {
        _510 = _265.iResolution[1u];
    }
    return _510;
}

static inline __attribute__((always_inline))
bool trailLive(thread const bool& demo, constant FlairUniforms& _265)
{
    bool _629 = !demo;
    bool _644;
    if (!_629)
    {
        bool _636 = _265.iTrail[0].w > 0.5;
        bool _643;
        if (_636)
        {
            _643 = _265.iPointer.z > 0.0;
        }
        else
        {
            _643 = _636;
        }
        _644 = _643;
    }
    else
    {
        _644 = _629;
    }
    return _644;
}

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _265)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_265.iResolution[0u], _265.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_265.iResolution[0], _265.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _297;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _297 = s.y;
    }
    else
    {
        float _306;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _306 = s.x;
        }
        else
        {
            float _316;
            if (meta.w < 1.5)
            {
                _316 = fast::min(s.x, s.y);
            }
            else
            {
                _316 = fast::max(s.x, s.y);
            }
            _306 = _316;
        }
        _297 = _306;
    }
    float k = _297;
    return float3((float2(_265.iResolution[0], _265.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _265)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _265).z;
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _265)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _265);
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
    float2 _440;
    if (b.w < 0.5)
    {
        _440 = a.xy;
    }
    else
    {
        _440 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _440;
    float2 t = b.xy - a.xy;
    float2 _476;
    if (dot(t, t) > 0.0)
    {
        _476 = fast::normalize(t);
    }
    else
    {
        _476 = float2(1.0, 0.0);
    }
    t = _476;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _265.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 demoPath(thread const float& t, constant FlairUniforms& _265, texture2d<float> uPath, sampler uPathSmplr)
{
    float s = t * 1.2999999523162841796875;
    float len = pathLength(uPath, uPathSmplr, _265);
    if (len > 0.0)
    {
        float lap = s / 6.283185482025146484375;
        float param = 0.0;
        float param_1 = len;
        bool closed = length(pathAt(uPath, uPathSmplr, param, _265).xy - pathAt(uPath, uPathSmplr, param_1, _265).xy) < 2.0;
        float _548;
        if (closed)
        {
            _548 = fract(lap) * len;
        }
        else
        {
            _548 = (0.5 - (0.5 * cos(3.1415927410125732421875 * lap))) * len;
        }
        float param_2 = _548;
        return pathAt(uPath, uPathSmplr, param_2, _265).xy;
    }
    float2 q = float2((0.3400000035762786865234375 * sin(s)) + (0.0500000007450580596923828125 * sin((s * 2.2999999523162841796875) + 1.0)), (0.2700000107288360595703125 * sin((s * 2.0) + 0.4000000059604644775390625)) + (0.039999999105930328369140625 * cos(s * 3.099999904632568359375)));
    return float2(_265.iResolution[0], _265.iResolution[1]) * (float2(0.5) + q);
}

static inline __attribute__((always_inline))
float4 trailAt(thread const int& i, thread const bool& live, constant FlairUniforms& _265, texture2d<float> uPath, sampler uPathSmplr)
{
    if (live)
    {
        return _265.iTrail[i];
    }
    float _658;
    if (i == 0)
    {
        _658 = _265.iTime;
    }
    else
    {
        _658 = ((floor(_265.iTime / 0.033330000936985015869140625) + 1.0) - float(i)) * 0.033330000936985015869140625;
    }
    float t = _658;
    float param = t;
    return float4(demoPath(param, _265, uPath, uPathSmplr), t, 1.0);
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
void trailFrom(thread const int& i, thread const bool& live, constant FlairUniforms& _265, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    gWalkI = i;
    if (live)
    {
        return;
    }
    gWalkBase = floor(_265.iTime / 0.033330000936985015869140625) + 1.0;
    gWalkPath = pathLength(uPath, uPathSmplr, _265) > 0.0;
    float s = ((gWalkBase - float(i)) * 0.033330000936985015869140625) * 1.2999999523162841796875;
    float4 phase = float4(s, (s * 2.2999999523162841796875) + 1.0, (s * 2.0) + 0.4000000059604644775390625, s * 3.099999904632568359375);
    gWalkCos = cos(phase);
    gWalkSin = sin(phase);
}

static inline __attribute__((always_inline))
bool trailJump(thread const float4& a, thread const float4& b, constant FlairUniforms& _265)
{
    bool _612 = (a.z - b.z) > 0.25;
    bool _625;
    if (_612)
    {
        _625 = length(a.xy - b.xy) > (0.02999999932944774627685546875 * trailUnit(_265));
    }
    else
    {
        _625 = _612;
    }
    return _625;
}

static inline __attribute__((always_inline))
float4 trailNext(thread const bool& live, constant FlairUniforms& _265, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    int i = gWalkI;
    gWalkI++;
    if (live)
    {
        return _265.iTrail[min(i, 31)];
    }
    if (gWalkPath)
    {
        float param = (gWalkBase - float(i)) * 0.033330000936985015869140625;
        return float4(demoPath(param, _265, uPath, uPathSmplr), (gWalkBase - float(i)) * 0.033330000936985015869140625, 1.0);
    }
    float2 q = float2((0.3400000035762786865234375 * gWalkSin.x) + (0.0500000007450580596923828125 * gWalkSin.y), (0.2700000107288360595703125 * gWalkSin.z) + (0.039999999105930328369140625 * gWalkCos.w));
    float4 point = float4(float2(_265.iResolution[0], _265.iResolution[1]) * (float2(0.5) + q), (gWalkBase - float(i)) * 0.033330000936985015869140625, 1.0);
    float4 c = (gWalkCos * float4(0.999061286449432373046875, 0.995037376880645751953125, 0.996246814727783203125, 0.990990817546844482421875)) + (gWalkSin * float4(0.043319769203662872314453125, 0.099501736462116241455078125, 0.08655820786952972412109375, 0.13392968475818634033203125));
    gWalkSin = (gWalkSin * float4(0.999061286449432373046875, 0.995037376880645751953125, 0.996246814727783203125, 0.990990817546844482421875)) - (gWalkCos * float4(0.043319769203662872314453125, 0.099501736462116241455078125, 0.08655820786952972412109375, 0.13392968475818634033203125));
    gWalkCos = c;
    return point;
}

static inline __attribute__((always_inline))
float pressWidth(thread const float4& a, thread const float4& b, thread const float& px, constant FlairUniforms& _265)
{
    float speed = (length(b.xy - a.xy) * px) / fast::max(abs(a.z - b.z), 0.0041666668839752674102783203125);
    return _265.uWidth * mix(0.300000011920928955078125, 1.0, 1.0 / (1.0 + ((speed * _265.uPressure) * 1.5)));
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _265, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    float px = 1.0 / trailUnit(_265);
    float2 p = fragCoord * px;
    bool param = _265.uDemo != 0u;
    bool live = trailLive(param, _265);
    int param_1 = 0;
    bool param_2 = live;
    float4 a = trailAt(param_1, param_2, _265, uPath, uPathSmplr);
    int param_3 = 1;
    bool param_4 = live;
    float4 b = trailAt(param_3, param_4, _265, uPath, uPathSmplr);
    float best = 1000000000.0;
    float bestU = 1.0;
    float bestV = 0.0;
    float bestFade = 0.0;
    float2 param_5 = p * 180.0;
    float rag = 0.89999997615814208984375 + (0.20000000298023223876953125 * vnoise(param_5));
    bool _921 = a.w > 0.5;
    bool _927;
    if (_921)
    {
        _927 = b.w > 0.5;
    }
    else
    {
        _927 = _921;
    }
    if (_927)
    {
        float reach = 1.10000002384185791015625 * _265.uWidth;
        int param_6 = 2;
        bool param_7 = live;
        trailFrom(param_6, param_7, _265, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
        float4 _967;
        float _1037;
        for (int k = 0; k < 31; k++)
        {
            bool _949 = b.w < 0.5;
            bool _958;
            if (!_949)
            {
                float4 param_8 = a;
                float4 param_9 = b;
                _958 = trailJump(param_8, param_9, _265);
            }
            else
            {
                _958 = _949;
            }
            if (_958)
            {
                break;
            }
            if ((k + 2) < 32)
            {
                bool param_10 = live;
                float4 _972 = trailNext(param_10, _265, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
                _967 = _972;
            }
            else
            {
                _967 = float4(0.0);
            }
            float4 next = _967;
            float2 off = fast::max(fast::max((fast::min(a.xy, b.xy) * px) - p, p - (fast::max(a.xy, b.xy) * px)), float2(0.0));
            float r = best + reach;
            bool _1003 = r > 0.0;
            bool _1013;
            if (_1003)
            {
                _1013 = dot(off, off) < (r * r);
            }
            else
            {
                _1013 = _1003;
            }
            if (_1013)
            {
                float4 param_11 = a;
                float4 param_12 = b;
                float param_13 = px;
                float wa = pressWidth(param_11, param_12, param_13, _265);
                bool _1027 = next.w > 0.5;
                bool _1036;
                if (_1027)
                {
                    float4 param_14 = b;
                    float4 param_15 = next;
                    _1036 = !trailJump(param_14, param_15, _265);
                }
                else
                {
                    _1036 = _1027;
                }
                if (_1036)
                {
                    float4 param_16 = b;
                    float4 param_17 = next;
                    float param_18 = px;
                    _1037 = pressWidth(param_16, param_17, param_18, _265);
                }
                else
                {
                    _1037 = wa;
                }
                float wb = _1037;
                float2 param_19 = p;
                float2 param_20 = a.xy * px;
                float2 param_21 = b.xy * px;
                float2 s = segment(param_19, param_20, param_21);
                float u = (float(k) + s.y) / 31.0;
                float fade = fast::clamp(1.0 - ((_265.iTime - mix(a.z, b.z, s.y)) / _265.uLife), 0.0, 1.0);
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
    float3 col = float3(_265.uInk);
    if (cover > 0.0)
    {
        float2 param_22 = float2(bestV * _265.uBristles, 3.7000000476837158203125);
        float2 param_23 = p * float2(55.0);
        int param_24 = 3;
        float _1207 = fbm(param_23, param_24);
        float bristle = (0.60000002384185791015625 * vnoise(param_22)) + (0.4000000059604644775390625 * _1207);
        float dry = ((_265.uDry * smoothstep(0.1500000059604644775390625, 1.0, bestU)) + ((0.3499999940395355224609375 * _265.uDry) * smoothstep(0.60000002384185791015625, 1.0, abs(bestV)))) + (0.699999988079071044921875 * (1.0 - bestFade));
        cover *= smoothstep(dry - 0.0599999986588954925537109375, dry + 0.0599999986588954925537109375, bristle * 1.10000002384185791015625);
        col = (float3(_265.uInk) * (1.0 + ((0.60000002384185791015625 * (1.0 - bristle)) * (1.0 - abs(bestV))))) + float3(0.039999999105930328369140625 * (1.0 - bristle));
    }
    if (_265.uPaper != 0u)
    {
        float2 param_25 = p * 9.0;
        int param_26 = 4;
        float _1276 = fbm(param_25, param_26);
        float2 param_27 = p * float2(400.0, 30.0);
        float3 paper = (float3(_265.uPaperColor) * (0.949999988079071044921875 + (0.070000000298023223876953125 * _1276))) - float3(0.02999999932944774627685546875 * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, vnoise(param_27)));
        fragColor = float4(mix(paper, col, float3(cover * 0.949999988079071044921875)), 1.0);
    }
    else
    {
        fragColor = float4(col, cover);
    }
}

fragment flair_brush_trail_frag_out flair_brush_trail_frag(constant FlairUniforms& _265 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_brush_trail_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    int gWalkI;
    float gWalkBase;
    bool gWalkPath;
    float4 gWalkCos;
    float4 gWalkSin;
    float _1320;
    if (_265.flair_flipY > 0.5)
    {
        _1320 = _265.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1320 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1320);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _265, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

