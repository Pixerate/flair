// flair-metal-hash: 7d784625
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
    float uPixel;
    int uBars;
    float uSpeed;
    float uWave;
    float3 uBackground;
    float3 uTextTop;
    packed_float3 uTextBottom;
    float uBackgroundAlpha;
};

constant spvUnsafeArray<float3, 8> _168 = spvUnsafeArray<float3, 8>({ float3(0.910000026226043701171875, 0.203999996185302734375, 0.24699999392032623291015625), float3(1.0, 0.54100000858306884765625, 0.122000001370906829833984375), float3(1.0, 0.882000029087066650390625, 0.301999986171722412109375), float3(0.24699999392032623291015625, 0.819999992847442626953125, 0.361000001430511474609375), float3(0.180000007152557373046875, 0.902000010013580322265625, 0.902000010013580322265625), float3(0.180000007152557373046875, 0.4199999868869781494140625, 1.0), float3(0.607999980449676513671875, 0.301999986171722412109375, 1.0), float3(1.0, 0.301999986171722412109375, 0.768999993801116943359375) });

struct flair_raster_bars_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _41, texture2d<float> uText, sampler uTextSmplr)
{
    float2 cell = floor(fragCoord / float2(_41.uPixel));
    float2 grid = fast::max(floor(float2(_41.iResolution[0], _41.iResolution[1]) / float2(_41.uPixel)), float2(1.0));
    float t = _41.iTime * _41.uSpeed;
    float3 col = _41.uBackground;
    float thick = fast::max(3.0, floor(grid.y * 0.0599999986588954925537109375));
    for (int i = 0; i < 8; i++)
    {
        if (i >= _41.uBars)
        {
            break;
        }
        float fi = float(i);
        float centre = floor(grid.y * (0.5 + (0.36000001430511474609375 * sin((t * 1.7000000476837158203125) + (fi * 0.550000011920928955078125)))));
        float dy = abs(cell.y - centre);
        if (dy <= thick)
        {
            float level0 = ceil((1.0 - (dy / (thick + 1.0))) * 4.0) / 4.0;
            col = (_168[i] * (0.25 + (0.75 * level0))) + float3(powr(level0, 4.0) * 0.3499999940395355224609375);
        }
    }
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float h = floor(grid.y * 0.300000011920928955078125);
    float w = h * aspect;
    float scroll = mod(((t * grid.y) * 0.3499999940395355224609375) + (grid.x * 0.89999997615814208984375), w + grid.x);
    float tx = (cell.x + scroll) - grid.x;
    float bob = floor(((sin((tx * 0.0599999986588954925537109375) + (t * 3.0)) * grid.y) * 0.14000000059604644775390625) * _41.uWave);
    float ty = cell.y - (floor((grid.y * 0.5) - (h * 0.5)) + bob);
    float2 uv = (float2(tx, ty) + float2(0.5)) / float2(w, h);
    float2 shadowUv = uv + float2((-1.0) / w, 1.0 / h);
    bool _293 = uv.x > 0.0;
    bool _299;
    if (_293)
    {
        _299 = uv.x < 1.0;
    }
    else
    {
        _299 = _293;
    }
    bool _305;
    if (_299)
    {
        _305 = uv.y > 0.0;
    }
    else
    {
        _305 = _299;
    }
    bool _311;
    if (_305)
    {
        _311 = uv.y < 1.0;
    }
    else
    {
        _311 = _305;
    }
    float _312;
    if (_311)
    {
        _312 = step(0.5, uText.sample(uTextSmplr, uv).w);
    }
    else
    {
        _312 = 0.0;
    }
    float ink = _312;
    bool _326 = shadowUv.x > 0.0;
    bool _332;
    if (_326)
    {
        _332 = shadowUv.x < 1.0;
    }
    else
    {
        _332 = _326;
    }
    bool _338;
    if (_332)
    {
        _338 = shadowUv.y > 0.0;
    }
    else
    {
        _338 = _332;
    }
    bool _344;
    if (_338)
    {
        _344 = shadowUv.y < 1.0;
    }
    else
    {
        _344 = _338;
    }
    float _345;
    if (_344)
    {
        _345 = step(0.5, uText.sample(uTextSmplr, shadowUv).w);
    }
    else
    {
        _345 = 0.0;
    }
    float shadow = _345;
    if (shadow > 0.5)
    {
        col = float3(0.0);
    }
    if (ink > 0.5)
    {
        float g = fast::clamp(floor(((uv.y - 0.300000011920928955078125) / 0.4000000059604644775390625) * 4.0) / 3.0, 0.0, 1.0);
        col = mix(float3(_41.uTextBottom), _41.uTextTop, float3(g));
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
    float3 _433;
    if (a > 0.0)
    {
        _433 = bg + (d / float3(a));
    }
    else
    {
        _433 = bg;
    }
    float3 fg = _433;
    float alpha = a + (opacity * (1.0 - a));
    float3 _455;
    if (alpha > 0.0)
    {
        _455 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _455 = bg;
    }
    float3 col = _455;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _41, texture2d<float> uText, sampler uTextSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _41, uText, uTextSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _41.uBackground;
    float param_4 = _41.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_raster_bars_frag_out flair_raster_bars_frag(constant FlairUniforms& _41 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_raster_bars_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _512;
    if (_41.flair_flipY > 0.5)
    {
        _512 = _41.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _512 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _512);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _41, uText, uTextSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

