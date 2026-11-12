// flair-metal-hash: fa5ee82b
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
    float uBands;
    float uShadow;
    float uSaturation;
    float uHighlight;
    packed_float3 uOutline;
    float uLine;
    float uThreshold;
    char _m20_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_cel_shade_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
    float4 _213;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _213 = overBackdrop(param, _69);
    }
    else
    {
        float2 param_1 = fract(uv);
        _213 = float4(testCard(param_1), 1.0);
    }
    return _213;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _69)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _69).xyz;
}

static inline __attribute__((always_inline))
float2 lumaAlpha(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _69)
{
    float2 param = uv;
    float4 c = pictureRGBA(tex, texSmplr, param, _69);
    return float2(dot(c.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)), c.w);
}

static inline __attribute__((always_inline))
float inkEdge(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& d, constant FlairUniforms& _69)
{
    float2 param = uv + float2(-d.x, d.y);
    float2 tl = lumaAlpha(tex, texSmplr, param, _69);
    float2 param_1 = uv + float2(0.0, d.y);
    float2 t = lumaAlpha(tex, texSmplr, param_1, _69);
    float2 param_2 = uv + d;
    float2 tr = lumaAlpha(tex, texSmplr, param_2, _69);
    float2 param_3 = uv - float2(d.x, 0.0);
    float2 l = lumaAlpha(tex, texSmplr, param_3, _69);
    float2 param_4 = uv + float2(d.x, 0.0);
    float2 r = lumaAlpha(tex, texSmplr, param_4, _69);
    float2 param_5 = uv - d;
    float2 bl = lumaAlpha(tex, texSmplr, param_5, _69);
    float2 param_6 = uv - float2(0.0, d.y);
    float2 b = lumaAlpha(tex, texSmplr, param_6, _69);
    float2 param_7 = uv + float2(d.x, -d.y);
    float2 br = lumaAlpha(tex, texSmplr, param_7, _69);
    float2 gx = ((((tr + (r * 2.0)) + br) - tl) - (l * 2.0)) - bl;
    float2 gy = ((((tl + (t * 2.0)) + tr) - bl) - (b * 2.0)) - br;
    return fast::max(length(float2(gx.x, gy.x)), length(float2(gx.y, gy.y)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _69, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_69.iResolution[0], _69.iResolution[1]);
    float2 px = float2(1.0) / float2(_69.iResolution[0], _69.iResolution[1]);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _69);
    float2 param_1 = uv + float2(px.x * 1.5, 0.0);
    float2 param_2 = uv - float2(px.x * 1.5, 0.0);
    float2 param_3 = uv + float2(0.0, px.y * 1.5);
    float2 param_4 = uv - float2(0.0, px.y * 1.5);
    float3 c = (((((pic.xyz * 4.0) + picture(uImage, uImageSmplr, param_1, _69)) + picture(uImage, uImageSmplr, param_2, _69)) + picture(uImage, uImageSmplr, param_3, _69)) + picture(uImage, uImageSmplr, param_4, _69)) / float3(8.0);
    float l = fast::max(dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)), 0.001000000047497451305389404296875);
    float x = l * _69.uBands;
    float k = floor(x);
    float w = fast::max(fwidth(x), 0.001000000047497451305389404296875) * 0.75;
    float stepped = (k + smoothstep(1.0 - w, 1.0, fract(x))) / _69.uBands;
    float shade = mix(_69.uShadow, 1.0, fast::clamp(stepped + (0.5 / _69.uBands), 0.0, 1.0));
    float3 hue = c / float3(l);
    hue = fast::max(mix(float3(1.0), hue, float3(_69.uSaturation)), float3(0.0));
    float3 col = fast::clamp((hue * shade) * 0.89999997615814208984375, float3(0.0), float3(1.0));
    float fw = fast::max(fwidth(l), 0.001000000047497451305389404296875);
    float hi = smoothstep(0.800000011920928955078125 - fw, 0.800000011920928955078125 + fw, l) * _69.uHighlight;
    col = mix(col, float3(1.0), float3(hi * 0.60000002384185791015625));
    float _519;
    if (_69.uLine > 0.0)
    {
        float2 param_5 = uv;
        float2 param_6 = px * _69.uLine;
        _519 = inkEdge(uImage, uImageSmplr, param_5, param_6, _69);
    }
    else
    {
        _519 = 0.0;
    }
    float edge = _519;
    float line = smoothstep(_69.uThreshold, _69.uThreshold + 0.0599999986588954925537109375, edge);
    col = mix(col, float3(_69.uOutline), float3(line));
    fragColor = float4(col, fast::max(pic.w, line));
}

fragment flair_cel_shade_frag_out flair_cel_shade_frag(constant FlairUniforms& _69 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_cel_shade_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _569;
    if (_69.flair_flipY > 0.5)
    {
        _569 = _69.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _569 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _569);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _69, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

