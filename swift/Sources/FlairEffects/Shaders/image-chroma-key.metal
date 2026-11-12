// flair-metal-hash: 72aedf6b
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    packed_float3 uKeyColor;
    float uSimilarity;
    float uSmoothness;
    float uDespill;
    float uShadowPreserve;
    char _m18_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_chroma_key_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float4 footage(thread const float2& uv, texture2d<float> uImage, sampler uImageSmplr)
{
    float4 _256;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        _256 = uImage.sample(uImageSmplr, uv);
    }
    else
    {
        float2 param = uv;
        _256 = float4(testCard(param), 1.0);
    }
    return _256;
}

static inline __attribute__((always_inline))
float3 toYCbCr(thread const float3& c)
{
    float y = dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    return float3(y, (c.z - y) / 1.85559999942779541015625, (c.x - y) / 1.574800014495849609375);
}

static inline __attribute__((always_inline))
float3 fromYCbCr(thread const float3& q)
{
    float r = q.x + (1.574800014495849609375 * q.z);
    float b = q.x + (1.85559999942779541015625 * q.y);
    return float3(r, ((q.x - (0.2125999927520751953125 * r)) - (0.072200000286102294921875 * b)) / 0.715200006961822509765625, b);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _56)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_56.uBackdrop) * _56.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_56.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _56, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_56.iResolution[0], _56.iResolution[1]);
    float2 param = uv;
    float4 s = footage(param, uImage, uImageSmplr);
    float3 src = s.xyz / float3(fast::max(s.w, 9.9999997473787516355514526367188e-05));
    float3 param_1 = src;
    float3 q = toYCbCr(param_1);
    float3 param_2 = float3(_56.uKeyColor);
    float3 k = toYCbCr(param_2);
    float keyChroma = fast::max(length(k.yz), 0.0199999995529651641845703125);
    float lit = fast::clamp(q.x / fast::max(k.x, 0.001000000047497451305389404296875), 0.60000002384185791015625, 1.60000002384185791015625);
    float d = length(q.yz - (k.yz * lit)) / keyChroma;
    float alpha = smoothstep(_56.uSimilarity, _56.uSimilarity + fast::max(_56.uSmoothness, 0.001000000047497451305389404296875), d) * s.w;
    float2 dir = k.yz / float2(keyChroma);
    float spill = fast::max(dot(q.yz, dir), 0.0);
    float3 param_3 = float3(q.x, q.yz - ((dir * spill) * _56.uDespill));
    float3 clean = fast::clamp(fromYCbCr(param_3), float3(0.0), float3(1.0));
    float shade = ((fast::clamp((1.0 - (q.x / fast::max(k.x, 0.001000000047497451305389404296875))) * 2.0, 0.0, 1.0) * _56.uShadowPreserve) * (1.0 - alpha)) * s.w;
    float4 param_4 = float4(clean * alpha, alpha + shade);
    fragColor = overBackdrop(param_4, _56);
}

fragment flair_image_chroma_key_frag_out flair_image_chroma_key_frag(constant FlairUniforms& _56 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_chroma_key_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _423;
    if (_56.flair_flipY > 0.5)
    {
        _423 = _56.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _423 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _423);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _56, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

