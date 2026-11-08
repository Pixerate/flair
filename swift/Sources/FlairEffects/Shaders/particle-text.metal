// flair-metal-hash: 0893d994
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
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
    float3 uColor;
    float3 uDust;
    packed_float3 uBackground;
    uint uTransparent;
    float uSize;
    float uDensity;
    float uScatter;
    float uDirection;
    float uBackgroundAlpha;
};

struct flair_particle_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float letters(thread const float2& p, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _223)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float frame = _223.iResolution[0u] / _223.iResolution[1u];
    float h = fast::min(_223.uSize, (frame * _223.uSize) / aspect);
    float2 uv = (p / float2(h * aspect, h)) + float2(0.5);
    bool _255 = uv.x < 0.0;
    bool _262;
    if (!_255)
    {
        _262 = uv.x > 1.0;
    }
    else
    {
        _262 = _255;
    }
    bool _269;
    if (!_262)
    {
        _269 = uv.y < 0.0;
    }
    else
    {
        _269 = _262;
    }
    bool _276;
    if (!_269)
    {
        _276 = uv.y > 1.0;
    }
    else
    {
        _276 = _269;
    }
    if (_276)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, uv).w;
}

static inline __attribute__((always_inline))
float scattered(thread const float2& home, thread const float& phase, constant FlairUniforms& _223)
{
    float frame = _223.iResolution[0u] / _223.iResolution[1u];
    float sx = fast::clamp((home.x / fast::max(frame * _223.uSize, 0.100000001490116119384765625)) + 0.5, 0.0, 1.0);
    float leave = smoothstep(0.119999997317790985107421875 + (0.2800000011920928955078125 * sx), 0.319999992847442626953125 + (0.2800000011920928955078125 * sx), phase);
    float back = smoothstep(0.660000026226043701171875, 0.939999997615814208984375, phase);
    float a = leave * (1.0 - back);
    return (a * a) * (3.0 - (2.0 * a));
}

static inline __attribute__((always_inline))
float2 lettersHalf(texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _223)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float frame = _223.iResolution[0u] / _223.iResolution[1u];
    float h = fast::min(_223.uSize, (frame * _223.uSize) / aspect);
    return float2(h * aspect, h) * 0.5;
}

static inline __attribute__((always_inline))
float3 gustOf(thread const float& g, constant FlairUniforms& _223)
{
    float ang = radians(_223.uDirection) + ((fract(g * 0.617999970912933349609375) - 0.5) * 1.2000000476837158203125);
    return float3(float2(cos(ang), sin(ang)) * (0.300000011920928955078125 + (0.180000007152557373046875 * g)), 0.300000011920928955078125 * (0.5 + (0.20000000298023223876953125 * g)));
}

static inline __attribute__((always_inline))
float4 cornerHashes(thread const float2& i)
{
    float2 x = fract(float2(i.x, i.x + 1.0) * 0.103100001811981201171875);
    float2 y = fract(float2(i.y, i.y + 1.0) * 0.103100001811981201171875);
    float4 X = x.xyxy;
    float4 Y = y.xxyy;
    float4 d = ((X * (Y + float4(33.3300018310546875))) + (Y * (X + float4(33.3300018310546875)))) + (X * (X + float4(33.3300018310546875)));
    float4 px = X + d;
    return fract((px + (Y + d)) * px);
}

static inline __attribute__((always_inline))
float eddy(thread const float2& p, thread float2& cellAt, thread float4& h)
{
    float2 i = floor(p);
    if (any(i != cellAt))
    {
        cellAt = i;
        float2 param = i;
        h = cornerHashes(param);
    }
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    return mix(mix(h.x, h.y, u.x), mix(h.z, h.w, u.x), u.y);
}

static inline __attribute__((always_inline))
float2 carried(thread const float2& home, thread const float& phase, thread const float& g, thread const float3& gust, thread float2& eddyCellA, thread float2& eddyCellB, thread float4& eddyHashA, thread float4& eddyHashB, constant FlairUniforms& _223)
{
    float2 param = home;
    float param_1 = phase;
    float a = scattered(param, param_1, _223);
    if (a <= 0.0)
    {
        return float2(0.0);
    }
    float t = phase * 3.0;
    float2 q = (home * 3.0) + float2(g * 5.30000019073486328125);
    float2 param_2 = q + float2(t, 0.0);
    float2 param_3 = eddyCellA;
    float4 param_4 = eddyHashA;
    float _486 = eddy(param_2, param_3, param_4);
    eddyCellA = param_3;
    eddyHashA = param_4;
    float2 param_5 = q + float2(4.69999980926513671875, t);
    float2 param_6 = eddyCellB;
    float4 param_7 = eddyHashB;
    float _499 = eddy(param_5, param_6, param_7);
    eddyCellB = param_6;
    eddyHashB = param_7;
    float2 swirl = float2(_486, _499) - float2(0.5);
    return ((gust.xy + (swirl * 0.800000011920928955078125)) + float2(0.0, gust.z * a)) * (a * _223.uScatter);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, thread float2& eddyCellA, thread float2& eddyCellB, thread float4& eddyHashA, thread float4& eddyHashB, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _223)
{
    float px = 1.0 / _223.iResolution[1u];
    float2 p = (fragCoord - (float2(_223.iResolution[0], _223.iResolution[1]) * 0.5)) * px;
    float cell = 1.0 / _223.uDensity;
    float phase = fract(_223.iTime / 6.0);
    float2 param = p;
    float2 param_1 = p;
    float param_2 = phase;
    float solid = letters(param, uText, uTextSmplr, _223) * (1.0 - smoothstep(0.0, 0.039999999105930328369140625, scattered(param_1, param_2, _223)));
    float3 col = _223.uColor;
    float cover = solid;
    bool moving = (phase > 0.119999997317790985107421875) && (phase < 0.939999997615814208984375);
    float2 box = lettersHalf(uText, uTextSmplr, _223) + float2(2.0 * cell);
    for (int gi = 0; gi < 6; gi++)
    {
        if (!moving)
        {
            break;
        }
        float g = float(gi);
        float param_3 = g;
        float3 gust = gustOf(param_3, _223);
        float2 home = p;
        for (int i = 0; i < 4; i++)
        {
            float2 param_4 = home;
            float param_5 = phase;
            float param_6 = g;
            float3 param_7 = gust;
            float2 _625 = carried(param_4, param_5, param_6, param_7, eddyCellA, eddyCellB, eddyHashA, eddyHashB, _223);
            home = p - _625;
        }
        if (any(abs(home) > box))
        {
            continue;
        }
        float2 base = floor(home / float2(cell));
        for (int y = -1; y <= 1; y++)
        {
            for (int x = -1; x <= 1; x++)
            {
                float2 c = base + float2(float(x), float(y));
                float2 param_8 = c + float2(0.730000019073486328125);
                if (floor(hash12(param_8) * 6.0) != g)
                {
                    continue;
                }
                float2 hc = (c + float2(0.5)) * cell;
                float2 param_9 = hc;
                float param_10 = phase;
                float a = scattered(param_9, param_10, _223);
                bool _695 = a < 0.00200000009499490261077880859375;
                bool _703;
                if (!_695)
                {
                    float2 param_11 = hc;
                    _703 = letters(param_11, uText, uTextSmplr, _223) < 0.5;
                }
                else
                {
                    _703 = _695;
                }
                if (_703)
                {
                    continue;
                }
                float2 param_12 = c;
                float2 j = hash22(param_12);
                float2 param_13 = hc;
                float param_14 = phase;
                float param_15 = g;
                float3 param_16 = gust;
                float2 _721 = carried(param_13, param_14, param_15, param_16, eddyCellA, eddyCellB, eddyHashA, eddyHashB, _223);
                float2 pos = (hc + _721) + ((((j - float2(0.5)) * cell) * 1.10000002384185791015625) * a);
                float r = (cell * (0.5 - (0.100000001490116119384765625 * a))) * (0.75 + (0.5 * j.x));
                float d = length(p - pos);
                float disc = (1.0 - smoothstep(r - px, r + (px * 0.5), d)) * (1.0 - ((smoothstep(0.60000002384185791015625, 1.0, a) * 0.60000002384185791015625) * j.y));
                if (disc > cover)
                {
                    cover = disc;
                    col = mix(_223.uColor, _223.uDust, float3(smoothstep(0.0, 0.5, a)));
                }
            }
        }
    }
    if (_223.uTransparent != 0u)
    {
        fragColor = float4(col, cover);
    }
    else
    {
        fragColor = float4(mix(float3(_223.uBackground), col, float3(cover)), 1.0);
    }
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
    float3 _860;
    if (a > 0.0)
    {
        _860 = bg + (d / float3(a));
    }
    else
    {
        _860 = bg;
    }
    float3 fg = _860;
    float alpha = a + (opacity * (1.0 - a));
    float3 _882;
    if (alpha > 0.0)
    {
        _882 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _882 = bg;
    }
    float3 col = _882;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, thread float2& eddyCellA, thread float2& eddyCellB, thread float4& eddyHashA, thread float4& eddyHashB, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _223)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, eddyCellA, eddyCellB, eddyHashA, eddyHashB, uText, uTextSmplr, _223);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_223.uBackground);
    float param_4 = _223.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_particle_text_frag_out flair_particle_text_frag(constant FlairUniforms& _223 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_particle_text_frag_out out = {};
    float2 eddyCellA = float2(-1000000000.0);
    float2 eddyCellB = float2(-1000000000.0);
    float4 eddyHashA = float4(0.0);
    float4 eddyHashB = float4(0.0);
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _939;
    if (_223.flair_flipY > 0.5)
    {
        _939 = _223.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _939 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _939);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, eddyCellA, eddyCellB, eddyHashA, eddyHashB, uText, uTextSmplr, _223);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

