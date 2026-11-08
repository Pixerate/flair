// flair-metal-hash: 1ab840a4
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
    uint uShowImage;
    char _m14_pad[12];
    packed_float3 uCenter;
    float uRadius;
    int uBars;
    float uLength;
    float3 uColorA;
    float3 uColorB;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    float uSpin;
    char _m23_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    uint uDemo;
};

struct flair_circular_spectrum_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _69)
{
    bool _236 = _69.uDemo != 0u;
    bool _244;
    if (_236)
    {
        _244 = _69.iBeat == 0.0;
    }
    else
    {
        _244 = _236;
    }
    bool _255;
    if (_244)
    {
        _255 = dot(_69.iAudio, _69.iAudio) == 0.0;
    }
    else
    {
        _255 = _244;
    }
    return _255;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _69)
{
    return exp((-mod(_69.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _69)
{
    return exp((-mod(_69.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _69)
{
    if (!soundDemo(_69))
    {
        return _69.iAudio;
    }
    float k = demoKick(_69);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_69.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_69.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_69))) + (0.07999999821186065673828125 * sin(_69.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _69)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_69))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_69.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_69.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_69.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_69)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_69)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_69.iSpectrum[i / 4][spvSMod(i, 4)], _69.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _69)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_69.uBackdrop) * _69.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_69.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _69)
{
    float4 _212;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _212 = overBackdrop(param, _69);
    }
    else
    {
        float2 param_1 = fract(uv);
        _212 = float4(testCard(param_1), 1.0);
    }
    return _212;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _69, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _69.iResolution[1u];
    float2 p = (fragCoord - (float2(_69.iResolution[0], _69.iResolution[1]) * 0.5)) * px;
    float4 s = sound(_69);
    float pulse = 1.0 + ((0.119999997317790985107421875 * s.y) * s.y);
    float r0 = _69.uRadius * pulse;
    float r = length(p);
    float a = precise::atan2(p.x, p.y) + (_69.iTime * _69.uSpin);
    float n = float(_69.uBars);
    float t = fract(a / 6.28318023681640625);
    float cell = floor(t * n);
    float mirrored = abs((((cell + 0.5) / n) * 2.0) - 1.0);
    float param = 1.0 - mirrored;
    float _502 = spectrum(param, _69);
    float v = _502;
    float len = _69.uLength * (0.07999999821186065673828125 + v);
    float within = ((abs(fract(t * n) - 0.5) * 6.28318023681640625) * r) / n;
    float width = (2.8274309635162353515625 * r0) / n;
    float radial = fast::max((r0 + 0.00999999977648258209228515625) - r, r - ((r0 + 0.00999999977648258209228515625) + len));
    float bar = fast::clamp(0.5 - (fast::max(radial, within - width) / px), 0.0, 1.0);
    float3 tint = mix(_69.uColorA, _69.uColorB, float3(mirrored));
    float4 acc = float4(_69.uBackground[0], _69.uBackground[1], _69.uBackground[2], _69.uBackgroundAlpha);
    float halo = exp((-abs((r - r0) - 0.0199999995529651641845703125)) / (0.039999999105930328369140625 + (0.0599999986588954925537109375 * s.x))) * (0.300000011920928955078125 + (0.699999988079071044921875 * s.x));
    float3 glowCol = (tint * halo) * 0.60000002384185791015625;
    float4 _597 = acc;
    float3 _599 = _597.xyz + glowCol;
    acc.x = _599.x;
    acc.y = _599.y;
    acc.z = _599.z;
    acc.w = fast::max(acc.w, fast::clamp(halo * 0.60000002384185791015625, 0.0, 1.0));
    acc = mix(acc, float4(tint * (0.800000011920928955078125 + (0.5 * v)), 1.0), float4(bar));
    float disc = fast::clamp((r0 - r) / px, 0.0, 1.0);
    if (disc > 0.0)
    {
        float2 uv = (p / float2(2.0 * r0)) + float2(0.5);
        float4 _651;
        if (_69.uShowImage != 0u)
        {
            float2 param_1 = float2(uv.x, uv.y);
            _651 = pictureRGBA(uImage, uImageSmplr, param_1, _69);
        }
        else
        {
            _651 = float4(_69.uCenter[0], _69.uCenter[1], _69.uCenter[2], 1.0);
        }
        float4 pic = _651;
        float3 c = mix(float3(_69.uCenter), pic.xyz, float3(pic.w)) * (0.89999997615814208984375 + (0.20000000298023223876953125 * s.y));
        acc = mix(acc, float4(c, 1.0), float4(disc));
    }
    float rim = fast::clamp(1.0 - (abs(r - r0) / (1.5 * px)), 0.0, 1.0);
    acc = mix(acc, float4(mix(tint, float3(1.0), float3(0.5)), 1.0), float4(rim * 0.800000011920928955078125));
    fragColor = acc;
}

fragment flair_circular_spectrum_frag_out flair_circular_spectrum_frag(constant FlairUniforms& _69 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_circular_spectrum_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _732;
    if (_69.flair_flipY > 0.5)
    {
        _732 = _69.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _732 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _732);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _69, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

