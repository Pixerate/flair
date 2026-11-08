// flair-metal-hash: 7be8a8ea
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
    float3 uBackground;
    float3 uBokeh;
    float3 uThread;
    packed_float3 uDew;
    float uSize;
    float uSpokes;
    float uTurns;
    float uWidth;
    float uDewAmount;
    float uSheen;
    float uSway;
    float uSpeed;
    float uBackgroundAlpha;
};

struct flair_spider_web_frag_out
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
float strand(thread const float& d, constant FlairUniforms& _169)
{
    return fast::clamp(((0.5 * _169.uWidth) + 0.5) - d, 0.0, 1.0);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _169)
{
    float px = 1.0 / _169.iResolution[1u];
    float2 p = (fragCoord - (float2(_169.iResolution[0], _169.iResolution[1]) * 0.5)) * px;
    float t = _169.iTime * _169.uSpeed;
    float2 param = (p * 2.2000000476837158203125) + float2(0.039999999105930328369140625 * t, 0.0);
    float2 param_1 = ((p * 4.099999904632568359375) - float2(0.0, 0.02999999932944774627685546875 * t)) + float2(9.0);
    float b = smoothstep(0.550000011920928955078125, 0.89999997615814208984375, vnoise(param)) + (0.60000002384185791015625 * smoothstep(0.60000002384185791015625, 0.949999988079071044921875, vnoise(param_1)));
    float3 col = mix(_169.uBackground, _169.uBokeh, float3(fast::clamp(b * (1.0 - (0.60000002384185791015625 * length(p))), 0.0, 1.0)));
    float R = 0.5 * _169.uSize;
    float r0 = length(p);
    float2 gust = float2(sin(t * 0.89999997615814208984375) + (0.4000000059604644775390625 * sin(t * 2.2999999523162841796875)), 0.60000002384185791015625 * sin((t * 0.699999988079071044921875) + 1.2999999523162841796875));
    p -= ((gust * (_169.uSway * 0.0350000001490116119384765625)) * smoothstep(0.0, R, r0));
    float2 param_2 = p * 3.0;
    float2 param_3 = (p * 3.0) + float2(7.30000019073486328125);
    p += ((float2(vnoise(param_2), vnoise(param_3)) - float2(0.5)) * 0.01200000010430812835693359375);
    float r = length(p);
    float a = precise::atan2(p.y, p.x);
    float n = floor(_169.uSpokes);
    float sector = 6.28318023681640625 / n;
    float h = 0.5 * sector;
    float k = floor((a / sector) + 0.5);
    float dSpoke = (r * abs(sin(a - (k * sector)))) / px;
    float param_4 = dSpoke;
    float spokes = (strand(param_4, _169) * smoothstep(0.014999999664723873138427734375, 0.02999999932944774627685546875, r)) * (1.0 - (0.60000002384185791015625 * smoothstep(R, 1.39999997615814208984375 * R, r)));
    float j = floor((a + 3.141590118408203125) / sector);
    float dm = (a + 3.141590118408203125) - ((j + 0.5) * sector);
    float rr = (r * cos(dm)) / cos(h);
    float spacing = R / _169.uTurns;
    float2 param_5 = float2(j, 5.30000019073486328125);
    float u = ((rr / spacing) - (j / n)) + (0.119999997317790985107421875 * (hash12(param_5) - 0.5));
    float x = u - floor(u + 0.5);
    float ring = floor(u + 0.5);
    float zone = smoothstep(0.119999997317790985107421875 * R, 0.1500000059604644775390625 * R, rr) * (1.0 - smoothstep(R - spacing, R, rr));
    float2 param_6 = float2(ring, j);
    float whole = step(0.0500000007450580596923828125, hash12(param_6));
    float param_7 = ((abs(x) * spacing) * cos(h)) / px;
    float spiral = (strand(param_7, _169) * zone) * whole;
    float hu = rr / (0.02500000037252902984619140625 * R);
    float param_8 = (((abs(hu - floor(hu + 0.5)) * 0.02500000037252902984619140625) * R) * cos(h)) / px;
    float hub = strand(param_8, _169) * (1.0 - smoothstep(0.07999999821186065673828125 * R, 0.0900000035762786865234375 * R, rr));
    float silk = fast::max(spokes, fast::max(spiral, hub));
    float2 param_9 = (p * 3.5) + float2(0.300000011920928955078125 * t, (-0.20000000298023223876953125) * t);
    float catchLight = 0.449999988079071044921875 + (0.89999997615814208984375 * smoothstep(0.3499999940395355224609375, 0.800000011920928955078125, vnoise(param_9)));
    float3 rainbow = float3(0.5) + (cos((float3(((2.0 * r) + (0.300000011920928955078125 * a)) + (0.0500000007450580596923828125 * t)) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
    float3 silkColor = mix(_169.uThread, (_169.uThread * rainbow) * 1.60000002384185791015625, float3(_169.uSheen * smoothstep(0.60000002384185791015625, 1.2000000476837158203125, catchLight))) * catchLight;
    col = mix(col, silkColor, float3(fast::clamp(silk, 0.0, 1.0)));
    col += (((silkColor * 0.119999997317790985107421875) * exp((-fast::min(dSpoke, (abs(x) * spacing) / px)) / (3.0 * _169.uWidth))) * zone);
    float cellLen = 0.04500000178813934326171875;
    float s = (a + 3.141590118408203125) * rr;
    float c = floor(s / cellLen);
    float2 param_10 = float2((ring * 13.1000003814697265625) + c, j);
    float2 dh = hash22(param_10);
    if (((dh.x < (_169.uDewAmount * 0.699999988079071044921875)) && (zone > 0.5)) && (whole > 0.5))
    {
        float rd = fast::min(mix(0.004999999888241291046142578125, 0.01400000043213367462158203125, dh.y * dh.y) * _169.uSize, fast::min(0.300000011920928955078125 * cellLen, (0.449999988079071044921875 * spacing) * cos(h)));
        float2 dd = float2(s - (((c + 0.300000011920928955078125) + (0.4000000059604644775390625 * dh.y)) * cellLen), (x * spacing) * cos(h));
        float dist = length(dd);
        float m = 1.0 - smoothstep(rd - px, rd, dist);
        float2 nn = dd / float2(rd);
        float spec = 1.0 - smoothstep(0.0, 0.3499999940395355224609375, length(nn - float2(-0.300000011920928955078125, 0.3499999940395355224609375)));
        float twinkle = 0.60000002384185791015625 + (0.4000000059604644775390625 * sin((_169.iTime * 2.0) + (dh.x * 40.0)));
        float3 drop = mix((col * 0.60000002384185791015625) + (float3(_169.uDew) * 0.1500000059604644775390625), float3(_169.uDew), float3(0.5 * smoothstep(0.5, 1.0, length(nn)))) + (((float3(_169.uDew) * spec) * twinkle) * 1.5);
        col = mix(col, drop, float3(m));
        col += ((((float3(_169.uDew) * 0.1500000059604644775390625) * twinkle) * exp((-dist) / (2.0 * rd))) * (1.0 - m));
    }
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _797;
    if (a > 0.0)
    {
        _797 = bg + (d / float3(a));
    }
    else
    {
        _797 = bg;
    }
    float3 fg = _797;
    float alpha = a + (opacity * (1.0 - a));
    float3 _819;
    if (alpha > 0.0)
    {
        _819 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _819 = bg;
    }
    float3 col = _819;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _169)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _169);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _169.uBackground;
    float param_4 = _169.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_spider_web_frag_out flair_spider_web_frag(constant FlairUniforms& _169 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_spider_web_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _877;
    if (_169.flair_flipY > 0.5)
    {
        _877 = _169.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _877 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _877);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _169);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

