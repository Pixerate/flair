// flair-metal-hash: f51340d7
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
    float uDiffusion;
    float uRadius;
    float uThreshold;
    float uHaze;
    float3 uTint;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_beauty_soft_focus_frag_out
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
    float4 _243;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _243 = overBackdrop(param, _101);
    }
    else
    {
        float2 param_1 = fract(uv);
        _243 = float4(testCard(param_1), 1.0);
    }
    return _243;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float4 softPicture(thread const float2& uv, thread const float& lod, constant FlairUniforms& _101, texture2d<float> uImage, sampler uImageSmplr)
{
    float4 _269;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        float4 param = uImage.sample(uImageSmplr, uv, level(lod));
        _269 = overBackdrop(param, _101);
    }
    else
    {
        float2 param_1 = fract(uv);
        _269 = float4(testCard(param_1), 1.0);
    }
    return _269;
}

static inline __attribute__((always_inline))
float3 discBlur(thread const float2& fragCoord, thread const float& r, constant FlairUniforms& _101, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 ts = float2(int2(uImage.get_width(), uImage.get_height()));
    float lod = fast::max(0.0, log2((r * fast::max(ts.x / _101.iResolution[0u], ts.y / _101.iResolution[1u])) / 4.0));
    float2 param = fragCoord;
    float spin = hash12(param) * 6.28318023681640625;
    float3 sum = float3(0.0);
    for (int i = 0; i < 12; i++)
    {
        float fi = float(i);
        float rr = sqrt((fi + 0.5) / 12.0) * r;
        float a = (fi * 2.399960041046142578125) + spin;
        float2 param_1 = (fragCoord + (float2(cos(a), sin(a)) * rr)) / float2(_101.iResolution[0], _101.iResolution[1]);
        float param_2 = lod;
        sum += softPicture(param_1, param_2, _101, uImage, uImageSmplr).xyz;
    }
    return sum / float3(12.0);
}

static inline __attribute__((always_inline))
float luma(thread const float3& c)
{
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _101, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_101.iResolution[0], _101.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _101);
    float2 param_1 = fragCoord;
    float param_2 = _101.uRadius;
    float3 blur = discBlur(param_1, param_2, _101, uImage, uImageSmplr);
    float3 param_3 = blur;
    float3 bloom = (blur * smoothstep(_101.uThreshold, 1.0, luma(param_3))) * _101.uTint;
    float3 col = pic.xyz + ((float3(1.0) - pic.xyz) * fast::clamp((bloom * _101.uDiffusion) * 1.5, float3(0.0), float3(1.0)));
    col = mix(col, blur, float3(_101.uDiffusion * 0.25));
    col = (col * (1.0 - _101.uHaze)) + (_101.uTint * _101.uHaze);
    fragColor = float4(col, pic.w);
}

fragment flair_beauty_soft_focus_frag_out flair_beauty_soft_focus_frag(constant FlairUniforms& _101 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_beauty_soft_focus_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _472;
    if (_101.flair_flipY > 0.5)
    {
        _472 = _101.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _472 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _472);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _101, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

