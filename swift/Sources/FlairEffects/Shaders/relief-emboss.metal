// flair-metal-hash: b110b503
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
    float uDepth;
    float uSmoothing;
    float uColour;
    float3 uSurface;
    packed_float3 uShade;
    float uLight;
    float uElevation;
    float uGrain;
    char _m21_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_relief_emboss_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float lightness(thread const float2& uv, thread const float& lod, constant FlairUniforms& _101, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    float2 st = fitCoverUV(uImage, uImageSmplr, param, _101);
    float3 _356;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        float4 param_1 = uImage.sample(uImageSmplr, st, level(lod));
        _356 = overBackdrop(param_1, _101).xyz;
    }
    else
    {
        float2 param_2 = fract(st);
        _356 = testCard(param_2);
    }
    float3 c = _356;
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
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
float4 pictureCoverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _101)
{
    float2 param = uv;
    float2 param_1 = fitCoverUV(tex, texSmplr, param, _101);
    return pictureRGBA(tex, texSmplr, param_1, _101);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _101, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_101.iResolution[0], _101.iResolution[1]);
    float2 texel = float2(1.0) / float2(_101.iResolution[0], _101.iResolution[1]);
    float lod = (_101.uSmoothing * 4.0) + log2(fast::max(float(int2(uImage.get_width(), uImage.get_height()).y) / _101.iResolution[1u], 1.0));
    float spread = 1.0 + (3.0 * _101.uSmoothing);
    float2 param = uv + float2(texel.x * spread, 0.0);
    float param_1 = lod;
    float2 param_2 = uv - float2(texel.x * spread, 0.0);
    float param_3 = lod;
    float dx = lightness(param, param_1, _101, uImage, uImageSmplr) - lightness(param_2, param_3, _101, uImage, uImageSmplr);
    float2 param_4 = uv + float2(0.0, texel.y * spread);
    float param_5 = lod;
    float2 param_6 = uv - float2(0.0, texel.y * spread);
    float param_7 = lod;
    float dy = lightness(param_4, param_5, _101, uImage, uImageSmplr) - lightness(param_6, param_7, _101, uImage, uImageSmplr);
    float strength = (_101.uDepth * 6.0) / spread;
    float3 N = fast::normalize(float3((-dx) * strength, (-dy) * strength, 1.0));
    float a = radians(_101.uLight);
    float e = radians(_101.uElevation);
    float3 L = float3(cos(a) * cos(e), sin(a) * cos(e), sin(e));
    float k = fast::max(dot(N, L), 0.0) / L.z;
    float2 param_8 = fragCoord;
    float grain = ((hash12(param_8) - 0.5) * 0.0500000007450580596923828125) * _101.uGrain;
    float2 param_9 = uv;
    float4 pic = pictureCoverRGBA(uImage, uImageSmplr, param_9, _101);
    float3 paper = mix(_101.uSurface, pic.xyz, float3(_101.uColour));
    float3 col = mix((float3(_101.uShade) * paper) / fast::max(_101.uSurface, float3(0.001000000047497451305389404296875)), paper, float3(fast::clamp(k, 0.0, 1.0)));
    col += (((paper * 0.20000000298023223876953125) * fast::clamp(k - 1.0, 0.0, 1.0)) + float3(grain));
    fragColor = float4(col, pic.w);
}

fragment flair_relief_emboss_frag_out flair_relief_emboss_frag(constant FlairUniforms& _101 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_relief_emboss_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _588;
    if (_101.flair_flipY > 0.5)
    {
        _588 = _101.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _588 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _588);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _101, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

