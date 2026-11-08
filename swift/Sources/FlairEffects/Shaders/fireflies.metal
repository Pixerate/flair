// flair-metal-hash: a69f24a7
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
    int uCount;
    char _m14_pad[12];
    packed_float3 uGlow;
    float uSize;
    float uSpeed;
    float uBlink;
    float uAttract;
    uint uMeadow;
    float3 uSky;
    float3 uDusk;
    float3 uGrass;
};

struct flair_fireflies_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2 pointerAt(thread const float& t, constant FlairUniforms& _197)
{
    float2 at = _197.iPointer.xy;
    for (int i = 0; i < 32; i++)
    {
        if (_197.iTrail[i].w < 0.5)
        {
            break;
        }
        at = _197.iTrail[i].xy;
        if (_197.iTrail[i].z <= t)
        {
            break;
        }
    }
    return at;
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
float grass(thread const float2& p, thread const float& aspect, constant FlairUniforms& _197)
{
    float2 param = float2(p.x * 3.0, 1.0);
    float ground = 0.100000001490116119384765625 + (0.039999999105930328369140625 * vnoise(param));
    float cover = 1.0 - smoothstep(ground - 0.00200000009499490261077880859375, ground + 0.00200000009499490261077880859375, p.y);
    for (int i = 0; i < 2; i++)
    {
        float fi = float(i);
        float n = 70.0 + (50.0 * fi);
        float y = p.y - ground;
        float sway = (sin(((_197.iTime * 0.800000011920928955078125) + (p.x * 4.0)) + fi) * 0.25) * y;
        float x = (p.x * n) + (sway * n);
        float id = floor(x);
        float2 param_1 = float2(id, fi);
        float hb = (0.039999999105930328369140625 + (0.10999999940395355224609375 * hash12(param_1))) * (1.0 - (0.3499999940395355224609375 * fi));
        float2 param_2 = float2(id, fi + 5.0);
        float lean = (hash12(param_2) - 0.5) * 1.5;
        float f = (fract(x) - 0.5) - ((lean * y) / hb);
        float blade = (step(0.0, y) * step(y, hb)) * step(abs(f), 0.5 * (1.0 - (y / hb)));
        cover = fast::max(cover, blade);
    }
    return cover;
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _197)
{
    float px = 1.0 / _197.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _197.iResolution[0u] / _197.iResolution[1u];
    float t = _197.iTime * _197.uSpeed;
    float hover = fast::clamp(_197.iPointer.z, 0.0, 1.0) * _197.uAttract;
    float3 light = float3(0.0);
    for (int i = 0; i < 80; i++)
    {
        if (i >= _197.uCount)
        {
            break;
        }
        float fi = float(i);
        float2 param = float2(fi, 1.89999997615814208984375);
        float2 h = hash22(param);
        float2 param_1 = float2(fi, 7.30000019073486328125);
        float2 g = hash22(param_1);
        float2 home = float2(h.x * aspect, 0.0599999986588954925537109375 + (0.800000011920928955078125 * powr(h.y, 1.39999997615814208984375)));
        float2 wander = float2((0.100000001490116119384765625 * sin((t * (0.1500000059604644775390625 + (0.20000000298023223876953125 * g.x))) + (g.y * 6.280000209808349609375))) + (0.039999999105930328369140625 * sin((t * (0.60000002384185791015625 + (0.5 * g.y))) + fi)), (0.0599999986588954925537109375 * sin((t * (0.119999997317790985107421875 + (0.180000007152557373046875 * g.y))) + (g.x * 6.280000209808349609375))) + (0.02999999932944774627685546875 * cos((t * (0.699999988079071044921875 + (0.4000000059604644775390625 * g.x))) + (fi * 1.2999999523162841796875))));
        float2 pos = home + wander;
        if (hover > 0.0)
        {
            float param_2 = _197.iTime - (0.25 * g.x);
            float2 near = ((pointerAt(param_2, _197) * px) + ((h - float2(0.5)) * 0.300000011920928955078125)) + (wander * 0.60000002384185791015625);
            pos = mix(pos, near, float2(hover * (0.4000000059604644775390625 + (0.5 * g.y))));
        }
        float2 dp = p - pos;
        float r = (0.0040000001899898052215576171875 * _197.uSize) * (0.699999988079071044921875 + (0.60000002384185791015625 * g.x));
        bool _571 = abs(dp.x) > (r * 20.0);
        bool _581;
        if (!_571)
        {
            _581 = abs(dp.y) > (r * 20.0);
        }
        else
        {
            _581 = _571;
        }
        if (_581)
        {
            continue;
        }
        float2 param_3 = float2(fi, 4.400000095367431640625);
        float period = (2.5 + (3.5 * hash12(param_3))) / _197.uBlink;
        float ph = fract((_197.iTime / period) + (h.y * 3.0));
        float blink = smoothstep(0.0, 0.0500000007450580596923828125, ph) * (1.0 - smoothstep(0.07999999821186065673828125, 0.4000000059604644775390625, ph));
        float on = 0.039999999105930328369140625 + blink;
        float d = length(dp);
        float core = 1.0 - smoothstep(r * 0.300000011920928955078125, r + px, d);
        float halo = exp((-d) / (r * 3.5));
        float3 hue = mix(float3(_197.uGlow), float3(1.0, 0.85000002384185791015625, 0.4000000059604644775390625), float3(0.300000011920928955078125 * g.y));
        light += ((hue * ((core * 2.0) + halo)) * on);
    }
    if (_197.uMeadow != 0u)
    {
        float3 sky = mix(_197.uDusk, _197.uSky, float3(smoothstep(0.0500000007450580596923828125, 1.0, p.y)));
        float2 param_4 = floor(fragCoord * 0.5);
        float stars = (step(0.995999991893768310546875, hash12(param_4)) * smoothstep(0.4000000059604644775390625, 0.89999997615814208984375, p.y)) * (0.5 + (0.5 * sin((_197.iTime * 2.0) + (p.x * 40.0))));
        sky += float3(stars * 0.5);
        float2 param_5 = p;
        float param_6 = aspect;
        float3 col = mix(sky, _197.uGrass, float3(grass(param_5, param_6, _197)));
        fragColor = float4(col + ((float3(1.0) - exp(-light)) * (float3(1.0) - col)), 1.0);
    }
    else
    {
        float3 param_7 = light;
        float4 _743 = glow(param_7);
        fragColor = _743;
    }
}

fragment flair_fireflies_frag_out flair_fireflies_frag(constant FlairUniforms& _197 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_fireflies_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _756;
    if (_197.flair_flipY > 0.5)
    {
        _756 = _197.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _756 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _756);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _197);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

