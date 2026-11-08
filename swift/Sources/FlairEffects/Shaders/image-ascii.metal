// flair-metal-hash: 652edabd
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
    float uCell;
    int uColourMode;
    float3 uInk;
    float3 uBackground;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    float uBackgroundAlpha;
};

constant spvUnsafeArray<int2, 10> _376 = spvUnsafeArray<int2, 10>({ int2(0), int2(0, 6336), int2(1015808, 0), int2(6336, 198), int2(1020032, 132), int2(31744, 31), int2(1030816, 686), int2(139875, 25378), int2(359754, 10591), int2(718382, 30781) });

struct flair_image_ascii_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _72)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_72.uBackdrop) * _72.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_72.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _72)
{
    float4 _215;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _215 = overBackdrop(param, _72);
    }
    else
    {
        float2 param_1 = fract(uv);
        _215 = float4(testCard(param_1), 1.0);
    }
    return _215;
}

static inline __attribute__((always_inline))
float glyphBit(thread const int2& g, thread const int& x, thread const int& y)
{
    if ((((x < 0) || (x > 4)) || (y < 0)) || (y > 6))
    {
        return 0.0;
    }
    int _255;
    if (y < 4)
    {
        _255 = g.x >> (x + (5 * y));
    }
    else
    {
        _255 = g.y >> (x + (5 * (y - 4)));
    }
    int bits = _255;
    return float(bits & 1);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _72, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 cell = float2(_72.uCell, (_72.uCell * 9.0) / 7.0);
    float2 id = floor(fragCoord / cell);
    float2 local = fract(fragCoord / cell);
    float2 param = ((id + float2(0.5)) * cell) / float2(_72.iResolution[0], _72.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _72);
    float3 src = pic.xyz;
    float l = powr(fast::clamp(dot(src, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)), 0.0, 1.0), 0.800000011920928955078125);
    int level0 = int(fast::min(l * 10.0, 9.0));
    int gx = int(floor(local.x * 7.0)) - 1;
    int gy = int(floor((1.0 - local.y) * 9.0)) - 1;
    int2 param_1 = _376[level0];
    int param_2 = gx;
    int param_3 = gy;
    float ink = glyphBit(param_1, param_2, param_3);
    float3 _394;
    if (_72.uColourMode == 1)
    {
        _394 = src * 1.25;
    }
    else
    {
        _394 = _72.uInk;
    }
    float3 tint = _394;
    fragColor = float4(mix(_72.uBackground, tint, float3(ink)), pic.w);
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
    float3 _462;
    if (a > 0.0)
    {
        _462 = bg + (d / float3(a));
    }
    else
    {
        _462 = bg;
    }
    float3 fg = _462;
    float alpha = a + (opacity * (1.0 - a));
    float3 _484;
    if (alpha > 0.0)
    {
        _484 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _484 = bg;
    }
    float3 col = _484;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _72, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _72, uImage, uImageSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _72.uBackground;
    float param_4 = _72.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_image_ascii_frag_out flair_image_ascii_frag(constant FlairUniforms& _72 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_ascii_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _540;
    if (_72.flair_flipY > 0.5)
    {
        _540 = _72.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _540 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _540);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _72, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

