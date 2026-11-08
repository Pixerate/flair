// flair-metal-hash: 04516120
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
    float3 uFill;
    packed_float3 uBackground;
    float uSize;
    float uSpeed;
    float uArcs;
    float uFlicker;
    float uBackgroundAlpha;
};

struct flair_electric_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 textHalf(texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _563)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float h = fast::min(_563.uSize, ((_563.iResolution[0u] / _563.iResolution[1u]) * _563.uSize) / aspect);
    return float2(h * aspect, h) * 0.5;
}

static inline __attribute__((always_inline))
float letters(thread const float2& p, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _563)
{
    float2 uv = (p / (textHalf(uText, uTextSmplr, _563) * 2.0)) + float2(0.5);
    bool _596 = uv.x < 0.0;
    bool _603;
    if (!_596)
    {
        _603 = uv.x > 1.0;
    }
    else
    {
        _603 = _596;
    }
    bool _610;
    if (!_603)
    {
        _610 = uv.y < 0.0;
    }
    else
    {
        _610 = _603;
    }
    bool _617;
    if (!_610)
    {
        _617 = uv.y > 1.0;
    }
    else
    {
        _617 = _610;
    }
    if (_617)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, uv).w;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float jag2(thread const float2& x, thread const float& seed)
{
    float2 i = floor(x) + float2(seed);
    float2 f = fract(x);
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return (mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0) - 1.0;
}

static inline __attribute__((always_inline))
float crackle(thread float2& x, thread const float& seed)
{
    float s = 0.0;
    float amp = 0.60000002384185791015625;
    for (int i = 0; i < 4; i++)
    {
        float2 param = x;
        float param_1 = seed + (float(i) * 7.30000019073486328125);
        s += (amp * jag2(param, param_1));
        x = (x * 2.099999904632568359375) + float2(3.099999904632568359375);
        amp *= 0.5;
    }
    return s;
}

static inline __attribute__((always_inline))
float soft(thread const float2& p, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _563)
{
    float2 param = p;
    float s = letters(param, uText, uTextSmplr, _563);
    for (int i = 0; i < 6; i++)
    {
        float a = float(i) * 1.0471999645233154296875;
        float2 param_1 = p + (float2(cos(a), sin(a)) * 0.004999999888241291046142578125);
        s += letters(param_1, uText, uTextSmplr, _563);
    }
    return s / 7.0;
}

static inline __attribute__((always_inline))
float3 arcLight(thread const float& d, thread const float& w, thread const float3& col)
{
    float core = exp(((-d) * d) / (w * w));
    float halo = (0.550000011920928955078125 * exp((-d) / (w * 4.0))) + (0.180000007152557373046875 * exp((-d) / (w * 20.0)));
    return ((mix(col, float3(1.0), float3(0.75)) * core) * 2.0) + (col * halo);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float jag(thread const float& x, thread const float& seed)
{
    float i = floor(x);
    float2 param = float2(i, seed);
    float2 param_1 = float2(i + 1.0, seed);
    return (mix(hash12(param), hash12(param_1), fract(x)) * 2.0) - 1.0;
}

static inline __attribute__((always_inline))
float zigzag(thread float& x, thread const float& seed)
{
    float s = 0.0;
    float amp = 0.60000002384185791015625;
    for (int i = 0; i < 5; i++)
    {
        float param = x;
        float param_1 = seed + (float(i) * 17.299999237060546875);
        s += (amp * jag(param, param_1));
        x *= 2.099999904632568359375;
        amp *= 0.5;
    }
    return s;
}

static inline __attribute__((always_inline))
float arcKick(thread const float& t, thread const float& seed, thread const float& rough, thread const float& open)
{
    float env = sqrt(fast::max(sin((3.141590118408203125 * t) * (1.0 - (0.5 * open))), 0.0));
    float param = t * 5.0;
    float param_1 = seed;
    float _234 = zigzag(param, param_1);
    return (_234 * rough) * env;
}

static inline __attribute__((always_inline))
float chordDist(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 1.0000000133514319600180897396058e-10), 0.0, 1.0);
    return length((p - a) - (ab * t));
}

static inline __attribute__((always_inline))
float2 arcDist(thread const float2& p, thread const float2& a, thread const float2& b, thread const float& seed, thread const float& rough, thread const float& open)
{
    float2 ab = b - a;
    float len = fast::max(length(ab), 9.9999997473787516355514526367188e-05);
    float2 dir = ab / float2(len);
    float2 q = p - a;
    float along = dot(q, dir);
    float side = dot(q, float2(-dir.y, dir.x));
    float t = fast::clamp(along / len, 0.0, 1.0);
    float band = (rough * len) * 1.2999999523162841796875;
    if (abs(side) > (band + 0.300000011920928955078125))
    {
        return float2(length(float2(along - (t * len), abs(side) - band)), t);
    }
    float2 lp = float2(along, side);
    float param = t - 0.008000000379979610443115234375;
    float param_1 = seed;
    float param_2 = rough;
    float param_3 = open;
    float2 c0 = float2((t - 0.008000000379979610443115234375) * len, arcKick(param, param_1, param_2, param_3) * len);
    float param_4 = t;
    float param_5 = seed;
    float param_6 = rough;
    float param_7 = open;
    float2 c1 = float2(t * len, arcKick(param_4, param_5, param_6, param_7) * len);
    float param_8 = t + 0.008000000379979610443115234375;
    float param_9 = seed;
    float param_10 = rough;
    float param_11 = open;
    float2 c2 = float2((t + 0.008000000379979610443115234375) * len, arcKick(param_8, param_9, param_10, param_11) * len);
    float2 param_12 = lp;
    float2 param_13 = c0;
    float2 param_14 = c1;
    float2 param_15 = lp;
    float2 param_16 = c1;
    float2 param_17 = c2;
    return float2(fast::min(chordDist(param_12, param_13, param_14), chordDist(param_15, param_16, param_17)), t);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _563)
{
    float px = 1.0 / _563.iResolution[1u];
    float2 p = (fragCoord - (float2(_563.iResolution[0], _563.iResolution[1]) * 0.5)) * px;
    float t = _563.iTime * _563.uSpeed;
    float w = fast::max(0.001599999959580600261688232421875, 0.60000002384185791015625 * px);
    float2 param = p;
    float mask = letters(param, uText, uTextSmplr, _563);
    float2 param_1 = float2(floor(t * 14.0), 4.0);
    float flick = mix(1.0, 0.3499999940395355224609375 + (0.64999997615814208984375 * step(0.25, hash12(param_1))), _563.uFlicker);
    float3 light = float3(0.0);
    for (int i = 0; i < 2; i++)
    {
        float fi = float(i);
        float seed = (fract(floor(t * (16.0 + (7.0 * fi))) * 0.0370999984443187713623046875) * 300.0) + (fi * 11.0);
        float2 param_2 = p * 14.0;
        float param_3 = seed;
        float _751 = crackle(param_2, param_3);
        float2 param_4 = (p * 14.0) + float2(5.19999980926513671875);
        float param_5 = seed + 3.0;
        float _762 = crackle(param_4, param_5);
        float2 jitter = float2(_751, _762) * 0.01200000010430812835693359375;
        float2 param_6 = p + jitter;
        float v = soft(param_6, uText, uTextSmplr, _563) - 0.5;
        float2 g = float2(dfdx(v), dfdy(v)) / float2(px);
        float d = abs(v) / fast::max(length(g), 1.0);
        float param_7 = d;
        float param_8 = w * (1.0 - (0.4000000059604644775390625 * fi));
        float3 param_9 = _563.uColor;
        light += (arcLight(param_7, param_8, param_9) * (1.0 - (0.449999988079071044921875 * fi)));
    }
    float halo = 0.0;
    for (int i_1 = 0; i_1 < 8; i_1++)
    {
        float a = float(i_1) * 0.785399973392486572265625;
        float2 dir = float2(cos(a), sin(a));
        float2 param_10 = p + (dir * 0.02500000037252902984619140625);
        float2 param_11 = p + (dir * 0.0599999986588954925537109375);
        halo += (letters(param_10, uText, uTextSmplr, _563) + (letters(param_11, uText, uTextSmplr, _563) * 0.5));
    }
    light += ((((_563.uColor * halo) / float3(12.0)) * 0.5) * (1.0 - mask));
    float2 hb = textHalf(uText, uTextSmplr, _563);
    for (int j = 0; j < 2; j++)
    {
        float fj = float(j);
        float clock = (t * 1.7000000476837158203125) + (fj * 0.5);
        float slot = floor(clock);
        float2 param_12 = float2(slot, fj + 0.699999988079071044921875);
        bool _899 = hash12(param_12) > _563.uArcs;
        bool _906;
        if (!_899)
        {
            _906 = fract(clock) > 0.3499999940395355224609375;
        }
        else
        {
            _906 = _899;
        }
        if (_906)
        {
            continue;
        }
        float2 param_13 = float2(slot, fj + 2.2999999523162841796875);
        float2 param_14 = float2(slot, fj + 8.1000003814697265625);
        float3 h = float3(hash22(param_13), hash12(param_14));
        float2 a_1 = float2((((h.x * 2.0) - 1.0) * hb.x) * 0.75, ((h.y - 0.5) * hb.y) * 0.800000011920928955078125);
        float2 b = float2(a_1.x + ((((h.x > 0.5) ? (-1.0) : 1.0) * (0.119999997317790985107421875 + (0.25 * h.z))) * hb.x), ((fract(h.z * 7.0) - 0.5) * hb.y) * 0.800000011920928955078125);
        float2 param_15 = p;
        float2 param_16 = a_1;
        float2 param_17 = b;
        float param_18 = floor(_563.iTime * 25.0) + (fj * 40.0);
        float param_19 = 0.20000000298023223876953125;
        float param_20 = 0.0;
        float2 d_1 = arcDist(param_15, param_16, param_17, param_18, param_19, param_20);
        float param_21 = d_1.x;
        float param_22 = w * 0.800000011920928955078125;
        float3 param_23 = _563.uColor;
        light += (((arcLight(param_21, param_22, param_23) * (1.0 - mask)) * (1.0 - (fract(clock) / 0.3499999940395355224609375))) * 0.89999997615814208984375);
    }
    float3 col = mix(float3(_563.uBackground), _563.uFill + ((_563.uColor * 0.0599999986588954925537109375) * flick), float3(mask));
    col += (float3(1.0) - exp((-light) * flick));
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
    float3 _1092;
    if (a > 0.0)
    {
        _1092 = bg + (d / float3(a));
    }
    else
    {
        _1092 = bg;
    }
    float3 fg = _1092;
    float alpha = a + (opacity * (1.0 - a));
    float3 _1114;
    if (alpha > 0.0)
    {
        _1114 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _1114 = bg;
    }
    float3 col = _1114;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _563)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, uText, uTextSmplr, _563);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_563.uBackground);
    float param_4 = _563.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_electric_text_frag_out flair_electric_text_frag(constant FlairUniforms& _563 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_electric_text_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1170;
    if (_563.flair_flipY > 0.5)
    {
        _1170 = _563.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1170 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1170);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, uText, uTextSmplr, _563);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

