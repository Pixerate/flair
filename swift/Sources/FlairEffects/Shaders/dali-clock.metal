// flair-metal-hash: fe2b58d5
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

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
    float3 uSkyTop;
    float3 uHorizon;
    float3 uSand;
    float3 uLedge;
    float3 uFace;
    packed_float3 uCase;
    float uSag;
    float uSpeed;
};

struct flair_dali_clock_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float3 unmelt(thread const float2& w, constant FlairUniforms& _190)
{
    float sag = _190.uSag;
    if (w.y >= 0.0)
    {
        return float3(w.x - 0.14000000059604644775390625, (0.0 + ((w.y - 0.0) / 0.5)) - (-0.0199999995529651641845703125), 0.0);
    }
    float d = 0.0 - w.y;
    float k = (2.400000095367431640625 * sag) + 0.001000000047497451305389404296875;
    float u = ((-1.0) + sqrt(1.0 + ((4.0 * k) * d))) / (2.0 * k);
    float sway = (((((0.0500000007450580596923828125 * sin(_190.iTime * 0.89999997615814208984375)) + (0.0199999995529651641845703125 * sin(_190.iTime * 2.099999904632568359375))) * sag) * u) * u) * 8.0;
    float x = (w.x - sway) - ((0.01200000010430812835693359375 * sag) * sin((u * 25.0) + _190.iTime));
    float narrow = 1.0 + ((((0.75 * sag) * smoothstep(0.0, 0.28799998760223388671875, u)) * u) / 0.23999999463558197021484375);
    return float3((x - 0.14000000059604644775390625) * narrow, (0.0 - u) - (-0.0199999995529651641845703125), u);
}

static inline __attribute__((always_inline))
float4 clockFace(thread const float2& q, thread const float& aa, constant FlairUniforms& _190)
{
    float r = length(q);
    float ang = precise::atan2(q.x, q.y);
    float crown = fast::max(abs(q.x) - 0.02500000037252902984619140625, abs((q.y - 0.23999999463558197021484375) - 0.02500000037252902984619140625) - 0.02199999988079071044921875);
    float body = fast::min(r - 0.23999999463558197021484375, crown);
    float cover = smoothstep(aa, -aa, body);
    if (cover <= 0.0)
    {
        return float4(0.0);
    }
    float3 col = _190.uFace * (1.0 - (0.180000007152557373046875 * smoothstep(0.09600000083446502685546875, 0.23999999463558197021484375, r)));
    float hourA = ang / 0.52359998226165771484375;
    float hourD = (abs(hourA - floor(hourA + 0.5)) * 0.52359998226165771484375) * r;
    float quarter = step(mod(floor(hourA + 0.5), 3.0), 0.5);
    float hourTick = (smoothstep((0.01200000010430812835693359375 + (0.006000000052154064178466796875 * quarter)) + aa, (0.01200000010430812835693359375 + (0.006000000052154064178466796875 * quarter)) - aa, hourD) * step(0.23999999463558197021484375 * (0.680000007152557373046875 - (0.07999999821186065673828125 * quarter)), r)) * step(r, 0.2064000070095062255859375);
    float minA = ang / 0.10471999645233154296875;
    float minD = (abs(minA - floor(minA + 0.5)) * 0.10471999645233154296875) * r;
    float minTick = (smoothstep(0.0030000000260770320892333984375 + aa, 0.0030000000260770320892333984375 - aa, minD) * step(0.1920000016689300537109375, r)) * step(r, 0.2064000070095062255859375);
    col = mix(col, float3(0.119999997317790985107421875, 0.100000001490116119384765625, 0.0900000035762786865234375), float3(fast::max(hourTick, minTick)));
    float t = _190.iTime * _190.uSpeed;
    float _458;
    float _468;
    float _482;
    float _493;
    for (int i = 0; i < 3; i++)
    {
        if (i == 0)
        {
            _458 = (t * 0.52359998226165771484375) / 12.0;
        }
        else
        {
            if (i == 1)
            {
                _468 = t * 0.52359998226165771484375;
            }
            else
            {
                _468 = t * 1.57079994678497314453125;
            }
            _458 = _468;
        }
        float a = _458;
        if (i == 0)
        {
            _482 = 0.119999997317790985107421875;
        }
        else
        {
            _482 = (i == 1) ? 0.180000007152557373046875 : 0.1920000016689300537109375;
        }
        float len = _482;
        if (i == 0)
        {
            _493 = 0.01200000010430812835693359375;
        }
        else
        {
            _493 = (i == 1) ? 0.008000000379979610443115234375 : 0.0030000000260770320892333984375;
        }
        float width = _493;
        float2 dir = float2(sin(a), cos(a));
        float along = fast::clamp(dot(q, dir), -0.039999999105930328369140625, len);
        float hd = length(q - (dir * along)) - width;
        float3 ink = select(float3(0.100000001490116119384765625, 0.0900000035762786865234375, 0.07999999821186065673828125), float3(0.699999988079071044921875, 0.1500000059604644775390625, 0.100000001490116119384765625), bool3(i == 2));
        col = mix(col, ink, float3(smoothstep(aa, -aa, hd)));
    }
    col = mix(col, float3(_190.uCase) * 0.699999988079071044921875, float3(smoothstep(aa, -aa, r - 0.01400000043213367462158203125)));
    float ringD = fast::max(body, -(r - 0.21600000560283660888671875));
    float bevel = 0.75 + (0.5 * dot(fast::normalize(q + float2(9.9999997473787516355514526367188e-06)), float2(-0.60000002384185791015625, 0.800000011920928955078125)));
    col = mix(col, float3(_190.uCase) * bevel, float3(smoothstep(aa, -aa, fast::min(ringD, crown))));
    return float4(col, cover);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _190)
{
    float2 w = (fragCoord - (float2(_190.iResolution[0], _190.iResolution[1]) * 0.5)) / float2(_190.iResolution[1u]);
    float aa = 1.5 / _190.iResolution[1u];
    float horizon = -0.180000007152557373046875;
    float3 col = mix(_190.uHorizon, _190.uSkyTop, float3(smoothstep(horizon, 0.5, w.y)));
    float2 param = float2((w.x * 2.5) + 3.0, 0.0);
    int param_1 = 4;
    float _641 = fbm(param, param_1);
    float cliffs = (horizon + 0.0500000007450580596923828125) + ((0.119999997317790985107421875 * _641) * smoothstep(-0.20000000298023223876953125, 0.89999997615814208984375, w.x));
    col = mix(col, mix(_190.uSand, _190.uSkyTop, float3(0.3499999940395355224609375)) * 0.89999997615814208984375, float3(smoothstep(aa, -aa, w.y - cliffs)));
    col = mix(col, _190.uSand * (0.75 + (0.5 * smoothstep(-0.5, horizon, w.y))), float3(smoothstep(aa, -aa, w.y - horizon)));
    float top = 0.1500000059604644775390625;
    float inBlock = step(w.x, 0.4199999868869781494140625);
    col = mix(col, _190.uLedge * 1.35000002384185791015625, float3((inBlock * smoothstep(aa, -aa, w.y - top)) * smoothstep(-aa, aa, w.y - 0.0)));
    col = mix(col, _190.uLedge * (0.800000011920928955078125 - (0.300000011920928955078125 * smoothstep(0.0, -0.5, w.y))), float3(inBlock * smoothstep(aa, -aa, w.y - 0.0)));
    col = mix(col, _190.uLedge * 0.5, float3(smoothstep(aa, -aa, abs(w.x - 0.4199999868869781494140625) - 0.00200000009499490261077880859375) * step(w.y, top)));
    float2 param_2 = w + float2(-0.02999999932944774627685546875, 0.02500000037252902984619140625);
    float3 sq = unmelt(param_2, _190);
    float shadow = smoothstep(0.00999999977648258209228515625, -0.00999999977648258209228515625, length(sq.xy) - 0.23999999463558197021484375) * inBlock;
    col *= (1.0 - ((0.4000000059604644775390625 * shadow) * step(w.y, top)));
    float2 param_3 = w;
    float3 q = unmelt(param_3, _190);
    float stretch = 1.0 + ((q.z * 6.0) * _190.uSag);
    float2 param_4 = q.xy;
    float param_5 = aa * stretch;
    float4 clock = clockFace(param_4, param_5, _190);
    float fold = exp(-powr((w.y - 0.0) / 0.0199999995529651641845703125, 2.0));
    float _825;
    if (q.z > 0.0)
    {
        _825 = 0.87999999523162841796875 - (0.20000000298023223876953125 * smoothstep(0.0, 0.300000011920928955078125, q.z));
    }
    else
    {
        _825 = 1.0;
    }
    float4 _841 = clock;
    float3 _843 = _841.xyz * (_825 * (1.0 - (0.300000011920928955078125 * fold)));
    clock.x = _843.x;
    clock.y = _843.y;
    clock.z = _843.z;
    float4 _856 = clock;
    float3 _859 = _856.xyz + float3((0.1500000059604644775390625 * fold) * smoothstep(-0.00999999977648258209228515625, 0.0199999995529651641845703125, w.y));
    clock.x = _859.x;
    clock.y = _859.y;
    clock.z = _859.z;
    col = mix(col, clock.xyz, float3(clock.w));
    fragColor = float4(col, 1.0);
}

fragment flair_dali_clock_frag_out flair_dali_clock_frag(constant FlairUniforms& _190 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_dali_clock_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _891;
    if (_190.flair_flipY > 0.5)
    {
        _891 = _190.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _891 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _891);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _190);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

