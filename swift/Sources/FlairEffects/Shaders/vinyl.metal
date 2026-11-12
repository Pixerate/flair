// flair-metal-hash: 55258895
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

// Implementation of signed integer mod accurate to SPIR-V specification
template<typename Tx, typename Ty>
inline Tx spvSMod(Tx x, Ty y)
{
    Tx remainder = x - y * (x / y);
    return select(Tx(remainder + y), remainder, remainder == 0 || (x >= 0) == (y >= 0));
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
    float uRpm;
    float3 uRecord;
    packed_float3 uSheen;
    float uShimmer;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    uint uArm;
    char _m20_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    uint uDemo;
};

struct flair_vinyl_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _82)
{
    bool _249 = _82.uDemo != 0u;
    bool _257;
    if (_249)
    {
        _257 = _82.iBeat == 0.0;
    }
    else
    {
        _257 = _249;
    }
    bool _268;
    if (_257)
    {
        _268 = dot(_82.iAudio, _82.iAudio) == 0.0;
    }
    else
    {
        _268 = _257;
    }
    return _268;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _82)
{
    return exp((-mod(_82.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _82)
{
    return exp((-mod(_82.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _82)
{
    if (!soundDemo(_82))
    {
        return _82.iAudio;
    }
    float k = demoKick(_82);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_82.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_82.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_82))) + (0.07999999821186065673828125 * sin(_82.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _82)
{
    float _343;
    if (soundDemo(_82))
    {
        _343 = mod(_82.iTime, 0.5);
    }
    else
    {
        _343 = _82.iBeat;
    }
    return _343;
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _82)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_82))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_82.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_82.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_82.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_82)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_82)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_82.iSpectrum[i / 4][spvSMod(i, 4)], _82.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _82)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_82.uBackdrop) * _82.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_82.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _82)
{
    float4 _225;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _225 = overBackdrop(param, _82);
    }
    else
    {
        float2 param_1 = fract(uv);
        _225 = float4(testCard(param_1), 1.0);
    }
    return _225;
}

static inline __attribute__((always_inline))
float segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length((p - a) - (ab * t));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _82, texture2d<float> uLabel, sampler uLabelSmplr)
{
    float px = 1.0 / _82.iResolution[1u];
    float2 p = (fragCoord - (float2(_82.iResolution[0], _82.iResolution[1]) * 0.5)) * px;
    float2 c = p + float2(0.119999997317790985107421875, 0.0);
    float4 s = sound(_82);
    float b = beat(_82);
    float _519;
    if (b >= 0.0)
    {
        _519 = exp((-b) * 8.0);
    }
    else
    {
        _519 = 0.0;
    }
    float hit = _519;
    float R = 0.439999997615814208984375;
    float r = length(c);
    float spin = ((_82.iTime * _82.uRpm) / 60.0) * 6.28318023681640625;
    float param = spin;
    float2 q = rot(param) * c;
    float ang = precise::atan2(q.y, q.x);
    float3 col = float3(_82.uBackground) * (0.85000002384185791015625 + (0.1500000059604644775390625 * smoothstep(0.89999997615814208984375, 0.0, length(p))));
    float shadow = (0.5 * exp((-fast::max(r - R, 0.0)) / 0.0199999995529651641845703125)) * step(R, r);
    col *= (1.0 - shadow);
    float alpha = fast::max(_82.uBackgroundAlpha, shadow);
    float disc = fast::clamp((R - r) / px, 0.0, 1.0);
    if (disc > 0.0)
    {
        float band = fast::clamp((R - r) / (R - 0.14000000059604644775390625), 0.0, 1.0);
        float param_1 = band;
        float _614 = spectrum(param_1, _82);
        float level0 = _614;
        float grooves = 0.5 + (0.5 * sin(r * 900.0));
        float wedge = powr(abs(cos(precise::atan2(c.y, c.x) - 0.800000011920928955078125)), 24.0);
        float sheen = (wedge * (0.25 + (_82.uShimmer * level0))) * (0.60000002384185791015625 + (0.4000000059604644775390625 * grooves));
        float3 rec = (_82.uRecord * (0.89999997615814208984375 + (0.20000000298023223876953125 * grooves))) + (float3(_82.uSheen) * sheen);
        rec += float3(0.02999999932944774627685546875 * sin((ang * 2.0) + (r * 40.0)));
        rec *= (1.0 - (0.4000000059604644775390625 * (smoothstep(0.0040000001899898052215576171875, 0.0, abs((r - R) + 0.01200000010430812835693359375)) + smoothstep(0.0040000001899898052215576171875, 0.0, abs(r - 0.1500000059604644775390625)))));
        col = mix(col, rec, float3(disc));
        float label = fast::clamp((0.12999999523162841796875 - r) / px, 0.0, 1.0);
        float2 param_2 = (q / float2(0.2599999904632568359375)) + float2(0.5);
        float4 pic = pictureRGBA(uLabel, uLabelSmplr, param_2, _82);
        float3 lab = mix(_82.uRecord, pic.xyz, float3(pic.w)) * (0.949999988079071044921875 + (0.100000001490116119384765625 * s.y));
        col = mix(col, lab, float3(label));
        col = mix(col, float3(0.800000011920928955078125), float3(fast::clamp((0.008000000379979610443115234375 - r) / px, 0.0, 1.0)));
    }
    if (_82.uArm != 0u)
    {
        float2 pivot = float2(0.4199999868869781494140625, 0.3400000035762786865234375);
        float swing = 0.319999992847442626953125 + (0.0040000001899898052215576171875 * hit);
        float2 head = pivot + (float2(-sin(swing + 0.89999997615814208984375), -cos(swing + 0.89999997615814208984375)) * 0.5);
        float2 param_3 = p;
        float2 param_4 = pivot;
        float2 param_5 = head;
        float arm = segment(param_3, param_4, param_5);
        float shade = fast::clamp((0.0089999996125698089599609375 - arm) / px, 0.0, 1.0);
        float2 param_6 = p + float2(-0.00999999977648258209228515625, 0.014999999664723873138427734375);
        float2 param_7 = pivot;
        float2 param_8 = head;
        col = mix(col * (1.0 - (0.3499999940395355224609375 * exp((-segment(param_6, param_7, param_8)) / 0.014999999664723873138427734375))), float3(0.7799999713897705078125, 0.7799999713897705078125, 0.819999992847442626953125), float3(shade));
        float2 param_9 = p;
        float2 param_10 = head;
        float2 param_11 = head + float2(-0.02999999932944774627685546875, -0.01200000010430812835693359375);
        float cart = segment(param_9, param_10, param_11);
        col = mix(col, float3(0.1500000059604644775390625), float3(fast::clamp((0.01600000075995922088623046875 - cart) / px, 0.0, 1.0)));
        float base = length(p - pivot);
        float foot = fast::clamp((0.0350000001490116119384765625 - base) / px, 0.0, 1.0);
        col = mix(col, float3(0.60000002384185791015625), float3(foot));
        col = mix(col, float3(0.300000011920928955078125), float3(fast::clamp((0.014999999664723873138427734375 - base) / px, 0.0, 1.0)));
        alpha = fast::max(alpha, fast::max(shade, fast::max(foot, fast::clamp((0.01600000075995922088623046875 - cart) / px, 0.0, 1.0))));
    }
    fragColor = float4(col, fast::max(alpha, disc));
}

fragment flair_vinyl_frag_out flair_vinyl_frag(constant FlairUniforms& _82 [[buffer(0)]], texture2d<float> uLabel [[texture(1)]], sampler uLabelSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_vinyl_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _886;
    if (_82.flair_flipY > 0.5)
    {
        _886 = _82.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _886 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _886);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _82, uLabel, uLabelSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

