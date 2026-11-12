// flair-metal-hash: 98577358
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
    float uWidth;
    float uHeight;
    float uRadius;
    float uBlur;
    packed_float3 uTint;
    float uTintAlpha;
    float uEdge;
    float uShadow;
    float uGrain;
    float uFloat;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_glass_card_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _122)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_122.uBackdrop) * _122.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_122.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _122)
{
    float4 _264;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _264 = overBackdrop(param, _122);
    }
    else
    {
        float2 param_1 = fract(uv);
        _264 = float4(testCard(param_1), 1.0);
    }
    return _264;
}

static inline __attribute__((always_inline))
float boxSdf(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _122)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _122).xyz;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _122, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_122.iResolution[0], _122.iResolution[1]);
    float px = 1.0 / _122.iResolution[1u];
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _122);
    float2 centre = (float2(_122.iResolution[0], _122.iResolution[1]) * 0.5) + float2(0.0, ((sin(_122.iTime * 1.10000002384185791015625) * _122.uFloat) * 0.01200000010430812835693359375) * _122.iResolution[1u]);
    float2 p = (fragCoord - centre) * px;
    float2 hs = (float2(_122.uWidth * _122.iResolution[0u], _122.uHeight * _122.iResolution[1u]) * 0.5) * px;
    float rad = fast::min(_122.uRadius, fast::min(hs.x, hs.y));
    float2 param_1 = p;
    float2 param_2 = hs;
    float param_3 = rad;
    float sd = boxSdf(param_1, param_2, param_3);
    float2 param_4 = p + float2(0.0, 0.0199999995529651641845703125);
    float2 param_5 = hs;
    float param_6 = rad;
    float shadow = exp((-fast::max(boxSdf(param_4, param_5, param_6), 0.0)) / 0.0350000001490116119384765625) * _122.uShadow;
    float3 col = pic.xyz * (1.0 - ((0.60000002384185791015625 * shadow) * step(0.0, sd)));
    float inside = fast::clamp(0.5 - (sd / px), 0.0, 1.0);
    if (inside > 0.0)
    {
        float3 sum = float3(0.0);
        float aspect = _122.iResolution[1u] / _122.iResolution[0u];
        for (int i = 0; i < 24; i++)
        {
            float fi = float(i);
            float r = sqrt((fi + 0.5) / 24.0) * _122.uBlur;
            float a = fi * 2.399960041046142578125;
            float2 param_7 = uv + (float2(cos(a) * aspect, sin(a)) * r);
            sum += picture(uImage, uImageSmplr, param_7, _122);
        }
        float3 glass = sum / float3(24.0);
        float luma = dot(glass, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
        glass = mix(float3(luma), glass, float3(1.14999997615814208984375));
        glass = mix(glass, float3(_122.uTint), float3(_122.uTintAlpha));
        glass += float3((_122.uEdge * 0.0599999986588954925537109375) * (0.5 - (((p.x / hs.x) - (p.y / hs.y)) * 0.25)));
        float2 param_8 = fragCoord;
        glass += float3((hash12(param_8) - 0.5) * _122.uGrain);
        float2 nrm = fast::normalize((p / fast::max(hs, float2(0.001000000047497451305389404296875))) + float2(9.9999997473787516355514526367188e-06));
        float lit = 0.3499999940395355224609375 + (0.64999997615814208984375 * fast::clamp(dot(nrm, float2(-0.707106769084930419921875, 0.707106769084930419921875)), 0.0, 1.0));
        float rim = fast::clamp(1.0 - ((abs(sd) - (0.60000002384185791015625 * px)) / px), 0.0, 1.0);
        glass = mix(glass, float3(1.0), float3((rim * _122.uEdge) * lit));
        glass += float3(((_122.uEdge * 0.119999997317790985107421875) * lit) * exp(sd / (6.0 * px)));
        col = mix(col, glass, float3(inside));
    }
    fragColor = float4(col, fast::max(pic.w, inside));
}

fragment flair_glass_card_frag_out flair_glass_card_frag(constant FlairUniforms& _122 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_glass_card_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _600;
    if (_122.flair_flipY > 0.5)
    {
        _600 = _122.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _600 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _600);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _122, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

