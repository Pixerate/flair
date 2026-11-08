// flair-metal-hash: db417415
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
    float uStrength;
    float uEvery;
    float uLength;
    float uGrain;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_subliminal_flicker_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _101)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_101.uBackdrop) * _101.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_101.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _101)
{
    float4 _318;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _318 = overBackdrop(param, _101);
    }
    else
    {
        float2 param_1 = fract(uv);
        _318 = float4(testCard(param_1), 1.0);
    }
    return _318;
}

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _101)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _246 = ts.x <= 1;
    bool _253;
    if (!_246)
    {
        _253 = ts.y <= 1;
    }
    else
    {
        _253 = _246;
    }
    bool _261;
    if (!_253)
    {
        _261 = _101.iResolution[0u] <= 0.0;
    }
    else
    {
        _261 = _253;
    }
    bool _268;
    if (!_261)
    {
        _268 = _101.iResolution[1u] <= 0.0;
    }
    else
    {
        _268 = _261;
    }
    if (_268)
    {
        return uv;
    }
    float boxAspect = _101.iResolution[0u] / _101.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _291;
    if (boxAspect > texAspect)
    {
        _291 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _291 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _291;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 pictureCoverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _101)
{
    float2 param = uv;
    float2 param_1 = fitCoverUV(tex, texSmplr, param, _101);
    return pictureRGBA(tex, texSmplr, param_1, _101);
}

static inline __attribute__((always_inline))
float3 pictureCover(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _101)
{
    float2 param = uv;
    return pictureCoverRGBA(tex, texSmplr, param, _101).xyz;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _101, texture2d<float> uImage, sampler uImageSmplr, texture2d<float> uHidden, sampler uHiddenSmplr)
{
    float2 uv = fragCoord / float2(_101.iResolution[0], _101.iResolution[1]);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _101);
    float k = mod(_101.iTime, _101.uEvery);
    float show = step(0.5 * _101.uEvery, k) * step(k, (0.5 * _101.uEvery) + _101.uLength);
    float2 param_1 = float2(0.5) + ((uv - float2(0.449999988079071044921875, 0.519999980926513671875)) / float2(1.2000000476837158203125));
    float3 hidden = pictureCover(uHidden, uHiddenSmplr, param_1, _101);
    float l = dot(hidden, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 col = mix(pic.xyz, mix(pic.xyz * 0.4000000059604644775390625, float3(smoothstep(0.20000000298023223876953125, 0.800000011920928955078125, l)), float3(0.800000011920928955078125)), float3(show * _101.uStrength));
    float2 param_2 = fragCoord + float2(floor(_101.iTime * 24.0) * 17.0);
    col += float3(((hash12(param_2) - 0.5) * 0.119999997317790985107421875) * _101.uGrain);
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), pic.w);
}

fragment flair_subliminal_flicker_frag_out flair_subliminal_flicker_frag(constant FlairUniforms& _101 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], texture2d<float> uHidden [[texture(2)]], sampler uImageSmplr [[sampler(1)]], sampler uHiddenSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_subliminal_flicker_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _470;
    if (_101.flair_flipY > 0.5)
    {
        _470 = _101.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _470 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _470);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _101, uImage, uImageSmplr, uHidden, uHiddenSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

