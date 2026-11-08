// flair-metal-hash: ead33e75
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

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
    float uPixel;
    float uDensity;
    int uPalette;
    float uChange;
    uint uBob;
    float3 uBackground;
    packed_float3 uOutline;
    float uBackgroundAlpha;
};

constant spvUnsafeArray<float3, 16> _131 = spvUnsafeArray<float3, 16>({ float3(0.0), float3(0.987999975681304931640625), float3(0.736999988555908203125), float3(0.486000001430511474609375), float3(0.658999979496002197265625, 0.063000001013278961181640625, 0.0), float3(0.972999989986419677734375, 0.2199999988079071044921875, 0.0), float3(0.987999975681304931640625, 0.62699997425079345703125, 0.2669999897480010986328125), float3(0.972999989986419677734375, 0.84700000286102294921875, 0.4709999859333038330078125), float3(0.0, 0.3449999988079071044921875, 0.0), float3(0.0, 0.72200000286102294921875, 0.0), float3(0.72200000286102294921875, 0.972999989986419677734375, 0.09399999678134918212890625), float3(0.0, 0.3449999988079071044921875, 0.972999989986419677734375), float3(0.23499999940395355224609375, 0.736999988555908203125, 0.987999975681304931640625), float3(0.40799999237060546875, 0.2669999897480010986328125, 0.987999975681304931640625), float3(0.84700000286102294921875, 0.0, 0.800000011920928955078125), float3(0.31400001049041748046875, 0.1879999935626983642578125, 0.0) });
constant spvUnsafeArray<float3, 16> _170 = spvUnsafeArray<float3, 16>({ float3(0.0), float3(1.0), float3(0.53299999237060546875, 0.0, 0.0), float3(0.666999995708465576171875, 1.0, 0.933000028133392333984375), float3(0.800000011920928955078125, 0.2669999897480010986328125, 0.800000011920928955078125), float3(0.0, 0.800000011920928955078125, 0.333000004291534423828125), float3(0.0, 0.0, 0.666999995708465576171875), float3(0.933000028133392333984375, 0.933000028133392333984375, 0.46700000762939453125), float3(0.86699998378753662109375, 0.53299999237060546875, 0.333000004291534423828125), float3(0.4000000059604644775390625, 0.2669999897480010986328125, 0.0), float3(1.0, 0.46700000762939453125, 0.46700000762939453125), float3(0.20000000298023223876953125), float3(0.46700000762939453125), float3(0.666999995708465576171875, 1.0, 0.4000000059604644775390625), float3(0.0, 0.53299999237060546875, 1.0), float3(0.732999980449676513671875) });
constant spvUnsafeArray<float3, 16> _219 = spvUnsafeArray<float3, 16>({ float3(0.0), float3(0.114000000059604644775390625, 0.1689999997615814208984375, 0.324999988079071044921875), float3(0.4939999878406524658203125, 0.14499999582767486572265625, 0.324999988079071044921875), float3(0.0, 0.528999984264373779296875, 0.3179999887943267822265625), float3(0.671000003814697265625, 0.3219999969005584716796875, 0.21199999749660491943359375), float3(0.3729999959468841552734375, 0.3409999907016754150390625, 0.310000002384185791015625), float3(0.760999977588653564453125, 0.76499998569488525390625, 0.7799999713897705078125), float3(1.0, 0.944999992847442626953125, 0.910000026226043701171875), float3(1.0, 0.0, 0.301999986171722412109375), float3(1.0, 0.638999998569488525390625, 0.0), float3(1.0, 0.925000011920928955078125, 0.15299999713897705078125), float3(0.0, 0.893999993801116943359375, 0.21199999749660491943359375), float3(0.16099999845027923583984375, 0.677999973297119140625, 1.0), float3(0.513999998569488525390625, 0.462999999523162841796875, 0.611999988555908203125), float3(1.0, 0.46700000762939453125, 0.658999979496002197265625), float3(1.0, 0.800000011920928955078125, 0.666999995708465576171875) });

struct flair_pixel_sprites_frag_out
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
int sprite(thread const float2& p, thread const float2& s)
{
    bool _230 = p.x < 0.0;
    bool _237;
    if (!_230)
    {
        _237 = p.y < 0.0;
    }
    else
    {
        _237 = _230;
    }
    bool _245;
    if (!_237)
    {
        _245 = p.x > 6.0;
    }
    else
    {
        _245 = _237;
    }
    bool _252;
    if (!_245)
    {
        _252 = p.y > 6.0;
    }
    else
    {
        _252 = _245;
    }
    if (_252)
    {
        return 0;
    }
    float x = fast::min(p.x, 6.0 - p.x);
    float2 param = s + float2(4.19999980926513671875);
    float eyeX = 1.0 + floor(hash12(param) * 2.0);
    float2 param_1 = s + float2(5.30000019073486328125);
    float eyeY = 3.0 + floor(hash12(param_1) * 2.0);
    bool _288 = x == eyeX;
    bool _295;
    if (_288)
    {
        _295 = p.y == eyeY;
    }
    else
    {
        _295 = _288;
    }
    if (_295)
    {
        return 3;
    }
    float2 param_2 = s + (float2(x, p.y) * 3.1700000762939453125);
    float h = hash12(param_2);
    float keep = (x == 3.0) ? 0.62000000476837158203125 : 0.5;
    if (h > keep)
    {
        return 0;
    }
    return (h < 0.100000001490116119384765625) ? 2 : 1;
}

static inline __attribute__((always_inline))
float3 pal(thread const int& i, constant FlairUniforms& _83)
{
    float3 _91;
    if (_83.uPalette == 1)
    {
        _91 = _131[i];
    }
    else
    {
        float3 _142;
        if (_83.uPalette == 2)
        {
            _142 = _170[i];
        }
        else
        {
            _142 = _219[i];
        }
        _91 = _142;
    }
    return _91;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _83)
{
    float2 cell = floor(fragCoord / float2(_83.uPixel));
    float2 slot = floor(cell / float2(11.0));
    float2 p = (cell - (slot * 11.0)) - float2(2.0);
    float2 param = slot + float2(0.699999988079071044921875);
    float gen = floor((_83.iTime * _83.uChange) + (hash12(param) * 8.0));
    float2 s = (slot * 1.7000000476837158203125) + float2(gen * 31.299999237060546875);
    float3 col = _83.uBackground;
    float2 param_1 = s + float2(9.1000003814697265625);
    if (hash12(param_1) > _83.uDensity)
    {
        fragColor = float4(col, 1.0);
        return;
    }
    if (_83.uBob != 0u)
    {
        float2 param_2 = slot + float2(2.900000095367431640625);
        p.y -= step(0.5, fract((_83.iTime * 1.2000000476837158203125) + hash12(param_2)));
    }
    float2 param_3 = p;
    float2 param_4 = s;
    int v = sprite(param_3, param_4);
    if (v == 0)
    {
        float2 param_5 = p + float2(1.0, 0.0);
        float2 param_6 = s;
        bool _443 = sprite(param_5, param_6) > 0;
        bool _454;
        if (!_443)
        {
            float2 param_7 = p - float2(1.0, 0.0);
            float2 param_8 = s;
            _454 = sprite(param_7, param_8) > 0;
        }
        else
        {
            _454 = _443;
        }
        bool _466;
        if (!_454)
        {
            float2 param_9 = p + float2(0.0, 1.0);
            float2 param_10 = s;
            _466 = sprite(param_9, param_10) > 0;
        }
        else
        {
            _466 = _454;
        }
        bool _477;
        if (!_466)
        {
            float2 param_11 = p - float2(0.0, 1.0);
            float2 param_12 = s;
            _477 = sprite(param_11, param_12) > 0;
        }
        else
        {
            _477 = _466;
        }
        bool edge = _477;
        float3 _479;
        if (edge)
        {
            _479 = float3(_83.uOutline);
        }
        else
        {
            _479 = col;
        }
        fragColor = float4(_479, 1.0);
        return;
    }
    float2 param_13 = s + float2(1.2999999523162841796875);
    int param_14 = 1 + int(hash12(param_13) * 15.0);
    float3 body = pal(param_14, _83);
    float2 param_15 = s + float2(2.599999904632568359375);
    int param_16 = 1 + int(hash12(param_15) * 15.0);
    float3 accent = pal(param_16, _83);
    float2 param_17 = s + float2(6.099999904632568359375);
    bool blink = fract((_83.iTime * 0.4000000059604644775390625) + hash12(param_17)) < 0.0599999986588954925537109375;
    if (v == 3)
    {
        col = select(float3(1.0), body, bool3(blink));
    }
    else
    {
        col = select(body, accent, bool3(v == 2));
    }
    bool _549 = v != 3;
    bool _555;
    if (_549)
    {
        _555 = p.y < 2.0;
    }
    else
    {
        _555 = _549;
    }
    if (_555)
    {
        col *= 0.75;
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
    float3 _610;
    if (a > 0.0)
    {
        _610 = bg + (d / float3(a));
    }
    else
    {
        _610 = bg;
    }
    float3 fg = _610;
    float alpha = a + (opacity * (1.0 - a));
    float3 _632;
    if (alpha > 0.0)
    {
        _632 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _632 = bg;
    }
    float3 col = _632;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _83)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _83);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _83.uBackground;
    float param_4 = _83.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_pixel_sprites_frag_out flair_pixel_sprites_frag(constant FlairUniforms& _83 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_pixel_sprites_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _690;
    if (_83.flair_flipY > 0.5)
    {
        _690 = _83.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _690 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _690);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _83);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

