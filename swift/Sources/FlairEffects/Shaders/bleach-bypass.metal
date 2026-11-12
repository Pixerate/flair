// flair-metal-hash: 91f4479c
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
    float uAmount;
    float uSaturation;
    float uContrast;
    float uCrush;
    packed_float3 uTint;
    float uGrain;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_bleach_bypass_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _87)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_87.uBackdrop) * _87.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_87.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _87)
{
    float4 _229;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _229 = overBackdrop(param, _87);
    }
    else
    {
        float2 param_1 = fract(uv);
        _229 = float4(testCard(param_1), 1.0);
    }
    return _229;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _87, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_87.iResolution[0], _87.iResolution[1]);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _87);
    float3 c = fast::clamp(pic.xyz, float3(0.0), float3(1.0));
    float l = dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 overlay = mix((c * 2.0) * l, float3(1.0) - (((float3(1.0) - c) * 2.0) * (1.0 - l)), float3(step(0.5, l)));
    float3 col = mix(c, overlay, float3(_87.uAmount));
    col = mix(float3(dot(col, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875))), col, float3(_87.uSaturation));
    col = fast::clamp(col, float3(0.0), float3(1.0));
    col = mix(col, (col * col) * (float3(3.0) - (col * 2.0)), float3(_87.uContrast));
    col = fast::max(col - float3(_87.uCrush), float3(0.0)) / float3(1.0 - _87.uCrush);
    col *= float3(_87.uTint);
    float frame = mod(floor(_87.iTime * 24.0), 64.0);
    float2 param_1 = fragCoord + (float2(17.3099994659423828125, 31.729999542236328125) * frame);
    col += float3(((hash12(param_1) - 0.5) * _87.uGrain) * (1.0 - abs((2.0 * l) - 1.0)));
    fragColor = float4(col, pic.w);
}

fragment flair_bleach_bypass_frag_out flair_bleach_bypass_frag(constant FlairUniforms& _87 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_bleach_bypass_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _397;
    if (_87.flair_flipY > 0.5)
    {
        _397 = _87.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _397 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _397);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _87, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

