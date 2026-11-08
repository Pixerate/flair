// flair-metal-hash: 57ed0c7d
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
    float uThreshold;
    char _m14_pad[12];
    packed_float3 uGlow;
    float uWidth;
    float uDim;
    float uPulse;
    char _m18_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_edge_glow_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _62)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_62.uBackdrop) * _62.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_62.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _62)
{
    float4 _206;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _206 = overBackdrop(param, _62);
    }
    else
    {
        float2 param_1 = fract(uv);
        _206 = float4(testCard(param_1), 1.0);
    }
    return _206;
}

static inline __attribute__((always_inline))
float2 lumaAlpha(thread const float2& uv, constant FlairUniforms& _62, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    float4 c = pictureRGBA(uImage, uImageSmplr, param, _62);
    return float2(dot(c.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)), c.w);
}

static inline __attribute__((always_inline))
float sobel(thread const float2& uv, thread const float2& d, constant FlairUniforms& _62, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv + float2(-d.x, d.y);
    float2 tl = lumaAlpha(param, _62, uImage, uImageSmplr);
    float2 param_1 = uv + float2(0.0, d.y);
    float2 t = lumaAlpha(param_1, _62, uImage, uImageSmplr);
    float2 param_2 = uv + d;
    float2 tr = lumaAlpha(param_2, _62, uImage, uImageSmplr);
    float2 param_3 = uv - float2(d.x, 0.0);
    float2 l = lumaAlpha(param_3, _62, uImage, uImageSmplr);
    float2 param_4 = uv + float2(d.x, 0.0);
    float2 r = lumaAlpha(param_4, _62, uImage, uImageSmplr);
    float2 param_5 = uv - d;
    float2 bl = lumaAlpha(param_5, _62, uImage, uImageSmplr);
    float2 param_6 = uv - float2(0.0, d.y);
    float2 b = lumaAlpha(param_6, _62, uImage, uImageSmplr);
    float2 param_7 = uv + float2(d.x, -d.y);
    float2 br = lumaAlpha(param_7, _62, uImage, uImageSmplr);
    float2 gx = ((((tr + (r * 2.0)) + br) - tl) - (l * 2.0)) - bl;
    float2 gy = ((((tl + (t * 2.0)) + tr) - bl) - (b * 2.0)) - br;
    return fast::max(length(float2(gx.x, gy.x)), length(float2(gx.y, gy.y)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _62, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_62.iResolution[0], _62.iResolution[1]);
    float2 d = float2(_62.uWidth) / float2(_62.iResolution[0], _62.iResolution[1]);
    float2 param = uv;
    float2 param_1 = d;
    float line = smoothstep(_62.uThreshold, _62.uThreshold + 0.1500000059604644775390625, sobel(param, param_1, _62, uImage, uImageSmplr));
    float2 param_2 = uv;
    float2 param_3 = d * 3.0;
    float halo = smoothstep(_62.uThreshold, _62.uThreshold + 0.5, sobel(param_2, param_3, _62, uImage, uImageSmplr));
    float2 c = (uv - float2(0.5)) * float2(_62.iResolution[0u] / _62.iResolution[1u], 1.0);
    float pulse = 1.0 - (_62.uPulse * (0.5 + (0.5 * sin((_62.iTime * 3.1415927410125732421875) - (length(c) * 12.0)))));
    float2 param_4 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_4, _62);
    float glow = (line + (0.449999988079071044921875 * halo)) * pulse;
    float3 light = (float3(_62.uGlow) * glow) + ((((float3(1.0) * line) * line) * 0.3499999940395355224609375) * pulse);
    float alpha = fast::max(pic.w, fast::clamp(glow, 0.0, 1.0));
    float3 col = (((pic.xyz * (1.0 - _62.uDim)) * pic.w) + light) / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05));
    fragColor = float4(col, alpha);
}

fragment flair_image_edge_glow_frag_out flair_image_edge_glow_frag(constant FlairUniforms& _62 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_edge_glow_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _494;
    if (_62.flair_flipY > 0.5)
    {
        _494 = _62.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _494 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _494);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _62, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

